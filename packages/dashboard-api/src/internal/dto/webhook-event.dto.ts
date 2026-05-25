import { IsObject, IsString } from 'class-validator';

export class WebhookEventDto {
  // Accept any string event name. wa-server fires events such as
  // 'messages.update', 'message.receipt', 'presence.update', 'call', etc.
  // that are not in the user-facing WEBHOOK_EVENTS list. Strict @IsIn
  // validation here caused 400 rejections for every such event, silently
  // preventing fanout. The internal endpoint is already protected by
  // InternalSecretGuard, so event-name allow-listing adds no real security.
  @IsString()
  event!: string;

  @IsString()
  sessionId!: string;

  @IsString()
  timestamp!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
