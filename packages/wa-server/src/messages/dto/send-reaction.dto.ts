import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendReactionDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(100) messageId: string;
  @IsString() @MaxLength(8) emoji: string;
}
