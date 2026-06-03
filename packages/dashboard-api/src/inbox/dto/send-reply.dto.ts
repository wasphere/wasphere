import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReplyDto {
  @ApiProperty({ description: 'Reply text', maxLength: 4096 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;
}
