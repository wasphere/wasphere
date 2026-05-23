import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, ArrayMaxSize, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({
    description: 'Array of WhatsApp message IDs to mark as read (max 100). Real message IDs arrive in incoming webhook events (field: `message.key.id`) or from the message history API (v1.1).',
    example: ['3EB0123456789ABCDEF0'],
    type: [String],
  })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  messageIds: string[];
}
