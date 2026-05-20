import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendTextDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(65536) text: string;
  @IsOptional() @IsString() @MaxLength(100) quotedId?: string;
}
