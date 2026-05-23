import { IsIn, IsObject, IsString } from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '../../lib/webhook-events';

export class WebhookEventDto {
  @IsString()
  @IsIn([...WEBHOOK_EVENTS])
  event!: WebhookEvent;

  @IsString()
  sessionId!: string;

  @IsString()
  timestamp!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
