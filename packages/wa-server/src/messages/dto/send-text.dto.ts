import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTextDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Text content of the message', example: 'Hello, world!', maxLength: 65536 })
  @IsString() @IsNotEmpty() @MaxLength(65536) text: string;

  @ApiPropertyOptional({
    description: 'Quote/reply to an existing message. Pass the WhatsApp message ID of the message you want to quote. Real message IDs arrive in incoming webhook events (field: `message.key.id`) or from the message history API (v1.1). Leave empty for a regular (non-quoted) message.',
    example: null,
  })
  @IsOptional() @IsString() @MaxLength(100) quotedId?: string;
}
