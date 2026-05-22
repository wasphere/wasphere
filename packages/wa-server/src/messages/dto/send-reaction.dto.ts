import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReactionDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'ID of the message to react to', example: '3EB0123456789ABCDEF0' })
  @IsString() @IsNotEmpty() @MaxLength(100) messageId: string;

  @ApiProperty({ description: 'Emoji to react with (empty string to remove reaction, max 8 chars)', example: '👍' })
  @IsString() @MaxLength(8) emoji: string;
}
