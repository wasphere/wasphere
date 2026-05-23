import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendContactDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Contact display name (max 100 characters, letters/numbers/common punctuation)', example: 'John Doe' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  @Matches(/^[a-zA-Z0-9À-ſ '\+\-\(\)\.,]+$/u, { message: 'displayName contains disallowed characters' })
  displayName: string;

  @ApiProperty({ description: 'Contact phone number (digits, +, -, and spaces only)', example: '+1 415 555 2671' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  @Matches(/^[\d\+\-\s]+$/, { message: 'phoneNumber must contain only digits, +, -, and spaces' })
  phoneNumber: string;
}
