import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { IncomingMessage, ServerResponse } from 'http';
import { Request, Response } from 'express';
import { WorkspacesService } from './workspaces.service';
import { proxyPermission, proxySessionId } from '../lib/proxy-permissions';
import { hasPermission, PermissionScope, WILDCARD_PERMISSION } from '../lib/permissions';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const STRIP_REQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-forwarded-for',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'authorization',
  'www-authenticate',
  'set-cookie',
  'x-api-token',
]);

const CONNECT_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly workspacesService: WorkspacesService) {}

  async proxy(
    userId: string,
    workspaceId: string,
    wildcardPath: string,
    req: Request,
    res: Response,
    apiKeyPermissions?: (PermissionScope | typeof WILDCARD_PERMISSION)[],
    sessionScope?: string | null,
  ): Promise<void> {
    const method = req.method.toUpperCase();

    if (!ALLOWED_METHODS.has(method)) {
      throw new HttpException('Method Not Allowed', HttpStatus.METHOD_NOT_ALLOWED);
    }

    // Decode and validate path — reject traversal attempts
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(wildcardPath);
    } catch {
      throw new BadRequestException('Invalid path encoding');
    }

    if (decodedPath.includes('..')) {
      throw new BadRequestException('Path traversal not allowed');
    }

    // API key scope enforcement: JWT users (apiKeyPermissions undefined) bypass.
    if (apiKeyPermissions !== undefined) {
      const required = proxyPermission(method, decodedPath);
      if (required === null) {
        throw new ForbiddenException('API key cannot access this proxy path');
      }
      if (!hasPermission(apiKeyPermissions, required)) {
        throw new ForbiddenException(`API key missing required permission: ${required}`);
      }

      // Session scope: a key bound to one session may only touch that session's
      // routes. Null scope = workspace-wide (no restriction).
      if (sessionScope) {
        const pathSessionId = proxySessionId(decodedPath);
        if (pathSessionId === null) {
          throw new ForbiddenException('Session-scoped API key cannot access this route');
        }
        if (pathSessionId !== sessionScope) {
          throw new ForbiddenException('API key is scoped to a different session');
        }
      }
    }

    let waServerUrl: string;
    let token: string;

    try {
      const result = await this.workspacesService.getDecryptedToken(
        userId,
        workspaceId,
      );
      waServerUrl = result.waServerUrl;
      token = result.token;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'GCM_AUTH_TAG_MISMATCH'
      ) {
        throw new BadGatewayException({ error: 'WA_SERVER_TOKEN_INVALID' });
      }
      throw err;
    }

    const base = waServerUrl.replace(/\/$/, '');
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const targetPath = `/${decodedPath}${queryString}`;
    const targetUrl = `${base}${targetPath}`;

    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const outHeaders: Record<string, string> = {
      'x-api-token': token,
    };

    // Forward headers from browser, excluding stripped ones
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (STRIP_REQUEST_HEADERS.has(lower)) continue;
      if (lower === 'host') continue;
      if (value === undefined) continue;
      outHeaders[lower] = Array.isArray(value) ? value.join(', ') : value;
    }

    const requestBody: Buffer | undefined =
      method !== 'GET' && method !== 'DELETE' ? (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from([]) : undefined;

    if (requestBody !== undefined) {
      outHeaders['content-length'] = String(requestBody.length);
    }

    await new Promise<void>((resolve) => {
      let connectTimer: ReturnType<typeof setTimeout> | null = null;
      let readTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      // Terminal completion — runs exactly once. Kept separate from "response
      // received" so res.end() is actually called (and the promise resolves) on
      // the success path, instead of leaking the socket + timer until the read
      // timeout fires.
      const finish = (beforeEnd?: () => void) => {
        if (settled) return;
        settled = true;
        if (connectTimer) clearTimeout(connectTimer);
        if (readTimer) clearTimeout(readTimer);
        if (beforeEnd) beforeEnd();
        if (!res.writableEnded) res.end();
        resolve();
      };

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search ?? ''),
        method,
        headers: outHeaders,
      };

      const proxyReq = transport.request(options, (proxyRes: IncomingMessage) => {
        // Response head received — connection established (NOT terminal).
        if (settled) {
          proxyRes.destroy();
          return;
        }
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }

        // Read timeout: from response reception until the body is fully read.
        readTimer = setTimeout(() => {
          proxyRes.destroy();
          finish(() => {
            if (!res.headersSent) {
              res.status(HttpStatus.GATEWAY_TIMEOUT).json({ error: 'WA_SERVER_TIMEOUT' });
            }
          });
        }, READ_TIMEOUT_MS);

        // Strip unwanted response headers
        const forwardHeaders: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
          if (value !== undefined) forwardHeaders[key] = value;
        }

        res.writeHead(proxyRes.statusCode ?? 200, forwardHeaders);

        proxyRes.on('data', (chunk: Buffer) => {
          if (!res.writableEnded) res.write(chunk);
        });

        // Body fully received — terminate the client response exactly once.
        proxyRes.on('end', () => finish());

        proxyRes.on('error', (err) => {
          finish(() => {
            this.logger.error('Proxy response error', err.message);
            if (!res.headersSent) {
              res.status(HttpStatus.BAD_GATEWAY).json({ error: 'WA_SERVER_UNREACHABLE' });
            }
          });
        });
      });

      connectTimer = setTimeout(() => {
        proxyReq.destroy();
        finish(() => {
          if (!res.headersSent) {
            res.status(HttpStatus.BAD_GATEWAY).json({ error: 'WA_SERVER_UNREACHABLE' });
          }
        });
      }, CONNECT_TIMEOUT_MS);

      proxyReq.on('error', (err: NodeJS.ErrnoException) => {
        finish(() => {
          this.logger.error('Proxy request error', err.message);
          if (!res.headersSent) {
            res.status(HttpStatus.BAD_GATEWAY).json({ error: 'WA_SERVER_UNREACHABLE' });
          }
        });
      });

      if (requestBody !== undefined && requestBody.length > 0) {
        proxyReq.write(requestBody);
      }
      proxyReq.end();
    });
  }
}
