import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface InboxEvent {
  type: 'message.new' | 'conversation.update' | 'message.status';
  workspaceId: string;
  conversationId?: string;
  payload?: Record<string, unknown>;
}

/**
 * In-process pub/sub for the Inbox. Single-instance only (no Redis) per the
 * design (§7). Commit 2 only emits; the SSE layer (Commit 3) subscribes via
 * `on()`. Multi-instance fan-out is deferred to v1.5.
 */
@Injectable()
export class InboxEventsService {
  private readonly emitter = new EventEmitter();

  constructor() {
    // SSE connection caps are enforced in the SSE layer (design §7), not here.
    this.emitter.setMaxListeners(0);
  }

  emit(event: InboxEvent): void {
    this.emitter.emit('inbox', event);
  }

  /** Subscribe; returns an unsubscribe function. */
  on(listener: (event: InboxEvent) => void): () => void {
    this.emitter.on('inbox', listener);
    return () => this.emitter.off('inbox', listener);
  }
}
