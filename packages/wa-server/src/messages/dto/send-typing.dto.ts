import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTypingDto {
  @ApiProperty({ description: 'Chat JID to send typing indicator to', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiPropertyOptional({ description: 'Set to true if the chat is a group (affects presence update routing)', example: false })
  @IsOptional() @IsBoolean() isGroup?: boolean;
}
