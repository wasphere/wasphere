import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, ArrayMaxSize, MaxLength } from 'class-validator';

export class MarkReadDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  messageIds: string[];
}
