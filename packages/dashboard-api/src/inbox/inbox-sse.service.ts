import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { InboxEventsService, InboxEvent } from './inbox-events.service';

interface Conn {
  workspaceId: string;
  userId: string;
  res: Response;
  lastEventAt: number;
  heartbeat: NodeJS.Timeout;
}

// Per design §7 (single-instance; no Redis).
const MAX_PER_WORKSPACE = 10;
const MAX_PER_USER = 3;
const HEARTBEAT_MS = 25_000;
const IDLE_TIMEOUT_MS = 30 * 60_000; // close a stream with no real events for 30 min
const SWEEP_MS = 5 * 60_000;

@Injectable()
export class InboxSseService implements OnModuleDestroy {
  private readonly logger = new Logger(InboxSseService.name);
  private readonly byWorkspace = new Map<string, Set<Conn>>();
  private readonly byUser = new Map<string, Set<Conn>>();
  private readonly unsubscribe: () => void;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: InboxEventsService,
  ) {
    // One emitter subscription for the whole process; fan out to streams.
    this.unsubscribe = this.events.on((ev) => this.dispatch(ev));
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_MS);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    this.unsubscribe();
    clearInterval(this.sweepTimer);
    for (const set of this.byWorkspace.values()) {
      for (const conn of set) this.teardown(conn);
    }
  }

  /** Handles one EventSource connection. Writes the stream directly (raw Response). */
  async handle(workspaceId: string, req: Request, res: Response): Promise<void> {
    const userId = await this.authenticate(workspaceId, req);
    if (!userId) {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }

    // Connection caps (design §7) — 429 tells the client to fall back to polling.
    if ((this.byWorkspace.get(workspaceId)?.size ?? 0) >= MAX_PER_WORKSPACE) {
      res.status(429).json({ statusCode: 429, message: 'Too many inbox streams for this workspace' });
      return;
    }
    if ((this.byUser.get(userId)?.size ?? 0) >= MAX_PER_USER) {
      res.status(429).json({ statusCode: 429, message: 'Too many inbox streams for this user' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
    });
    res.write('retry: 3000\n');
    res.write(': connected\n\n');

    const conn: Conn = {
      workspaceId,
      userId,
      res,
      lastEventAt: Date.now(),
      heartbeat: setInterval(() => {
        if (res.writableEnded) return;
        res.write(': ping\n\n');
        // idle timeout: no real events for 30 min -> close (client auto-reconnects)
        if (Date.now() - conn.lastEventAt > IDLE_TIMEOUT_MS) this.teardown(conn);
      }, HEARTBEAT_MS),
    };
    conn.heartbeat.unref();

    this.add(conn);
    req.on('close', () => this.teardown(conn));
  }

  // ── event fan-out ───────────────────────────────────────────────────────────

  private dispatch(ev: InboxEvent): void {
    const set = this.byWorkspace.get(ev.workspaceId);
    if (!set || set.size === 0) return;
    const frame = `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
    for (const conn of set) {
      if (conn.res.writableEnded) continue;
      conn.res.write(frame);
      conn.lastEventAt = Date.now();
    }
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  // EventSource can't set headers, so accept the JWT from the `wa_token` cookie;
  // also accept a Bearer header (for the UI server-side proxy and curl tests).
  private async authenticate(workspaceId: string, req: Request): Promise<string | null> {
    const token = this.extractToken(req);
    if (!token) return null;
    let payload: { sub?: string };
    try {
      payload = this.jwt.verify(token, { algorithms: ['HS256'] });
    } catch {
      return null;
    }
    const userId = payload.sub;
    if (!userId) return null;
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    return member ? userId : null;
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    const cookie = req.headers.cookie;
    if (cookie) {
      for (const part of cookie.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === 'wa_token') return decodeURIComponent(v.join('='));
      }
    }
    return null;
  }

  // ── connection bookkeeping ───────────────────────────────────────────────────

  private add(conn: Conn): void {
    let ws = this.byWorkspace.get(conn.workspaceId);
    if (!ws) this.byWorkspace.set(conn.workspaceId, (ws = new Set()));
    ws.add(conn);
    let u = this.byUser.get(conn.userId);
    if (!u) this.byUser.set(conn.userId, (u = new Set()));
    u.add(conn);
  }

  private teardown(conn: Conn): void {
    clearInterval(conn.heartbeat);
    this.byWorkspace.get(conn.workspaceId)?.delete(conn);
    if (this.byWorkspace.get(conn.workspaceId)?.size === 0) this.byWorkspace.delete(conn.workspaceId);
    this.byUser.get(conn.userId)?.delete(conn);
    if (this.byUser.get(conn.userId)?.size === 0) this.byUser.delete(conn.userId);
    if (!conn.res.writableEnded) conn.res.end();
  }

  // 5-min sweep: drop any connection whose socket is already closed.
  private sweep(): void {
    let dropped = 0;
    for (const set of this.byWorkspace.values()) {
      for (const conn of set) {
        if (conn.res.writableEnded || conn.res.destroyed) {
          this.teardown(conn);
          dropped++;
        }
      }
    }
    if (dropped > 0) this.logger.log(`[InboxSSE] swept ${dropped} dead stream(s)`);
  }

  /** Test/diagnostic helper. */
  counts(): { workspaces: number; totalStreams: number } {
    let total = 0;
    for (const set of this.byWorkspace.values()) total += set.size;
    return { workspaces: this.byWorkspace.size, totalStreams: total };
  }
}
