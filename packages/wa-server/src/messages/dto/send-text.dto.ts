import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTextDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Text content of the message', example: 'Hello, world!', maxLength: 65536 })
  @IsString() @IsNotEmpty() @MaxLength(65536) text: string;

  @ApiPropertyOptional({ description: 'Message ID of the message to quote/reply to', example: 'ABCDEF1234567890', maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100) quotedId?: string;
}
