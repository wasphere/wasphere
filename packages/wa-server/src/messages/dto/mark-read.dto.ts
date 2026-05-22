import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, ArrayMaxSize, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ description: 'Chat JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Array of message IDs to mark as read (max 100)', example: ['3EB0123456789ABCDEF0'], type: [String] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  messageIds: string[];
}
