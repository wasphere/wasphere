import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'New text content for the edited message (max 65536 characters)', example: 'Updated message content' })
  @IsString() @IsNotEmpty() @MaxLength(65536) text: string;
}
