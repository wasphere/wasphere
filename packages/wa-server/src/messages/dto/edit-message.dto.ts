import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class EditMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(65536) text: string;
}
