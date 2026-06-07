import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Start a brand-new conversation by sending the first message to a number. */
export class StartConversationDto {
  @ApiProperty({ description: 'Session to send from' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;

  @ApiProperty({ description: 'Recipient phone number (digits, country code; no +)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  to!: string;

  @ApiProperty({ description: 'First message text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;
}
