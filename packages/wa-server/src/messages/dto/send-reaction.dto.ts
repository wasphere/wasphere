import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReactionDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({
    description: 'WhatsApp message ID of the message to react to. Real message IDs arrive in incoming webhook events (field: `message.key.id`) or from the message history API (v1.1).',
    example: '3EB0123456789ABCDEF0',
  })
  @IsString() @IsNotEmpty() @MaxLength(100) messageId: string;

  @ApiProperty({ description: 'Emoji to react with. Pass an empty string `""` to remove an existing reaction.', example: '👍' })
  @IsString() @MaxLength(8) emoji: string;
}
