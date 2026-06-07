import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { WebhookService } from '../webhooks/webhook.service';

// Last path segment → friendly inbox message type. Only message kinds that
// belong in a conversation thread are mirrored; reaction/edit/delete/typing/
// presence/read/bulk are intentionally excluded.
const TYPE_BY_SEGMENT: Record<string, string> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
  sticker: 'sticker',
  gif: 'video',
  'view-once': 'image',
  location: 'location',
  contact: 'contact',
  buttons: 'buttons',
  list: 'list',
  poll: 'poll',
};

function buildContent(type: string, b: Record<string, any>): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { text: b.text };
    case 'image':
    case 'video':
      return { caption: b.caption ?? null, dataUri: b.url };
    case 'audio':
      return { dataUri: b.url };
    case 'document':
      return { fileName: b.fileName ?? null, dataUri: b.url };
    case 'sticker':
      return { dataUri: b.url };
    case 'location':
      return { latitude: b.latitude, longitude: b.longitude, name: b.name ?? null, address: b.address ?? null };
    case 'contact':
      return { displayName: b.displayName ?? null, phoneNumber: b.phoneNumber ?? null };
    case 'buttons':
      return { text: b.text, footer: b.footer ?? null, buttons: b.buttons ?? [] };
    case 'list':
      return { text: b.text, title: b.title ?? null, buttonText: b.buttonText ?? null, sections: b.sections ?? [] };
    case 'poll':
      return { name: b.name, options: b.options ?? [], selectableCount: b.selectableCount ?? 1 };
    default:
      return {};
  }
}

/**
 * After a successful outbound send, mirror it to the dashboard as a
 * `message.sent` event so every message — sent via the API, the tester, OR the
 * inbox — shows up in the Inbox thread (and picks up delivery-status ticks).
 * The dashboard de-duplicates by waMessageId, so the inbox composer's own
 * record is not duplicated.
 */
@Injectable()
export class OutboundEventInterceptor implements NestInterceptor {
  constructor(private readonly webhooks: WebhookService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap((result: any) => {
        try {
          const messageId: string | undefined = result?.messageId;
          const to: string | undefined = (req.body as Record<string, any>)?.to;
          const sessionId: string | undefined = (req.params as Record<string, any>)?.sessionId;
          if (!messageId || !to || !sessionId) return;

          const segment = req.path.split('/').filter(Boolean).pop() ?? '';
          const type = TYPE_BY_SEGMENT[segment];
          if (!type) return; // reaction/edit/delete/etc — not a thread message

          void this.webhooks.fire('message.sent', sessionId, {
            to,
            messageId,
            type,
            content: buildContent(type, req.body as Record<string, any>),
            timestamp: Math.floor(Date.now() / 1000),
          });
        } catch {
          /* never break a successful send because of mirroring */
        }
      }),
    );
  }
}
