import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class SendTypingDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
}
