import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendContactDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
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
