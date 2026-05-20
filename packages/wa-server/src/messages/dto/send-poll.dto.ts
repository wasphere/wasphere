import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max, MaxLength } from 'class-validator';

export class SendPollDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(255) name: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(12)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  options: string[];
  @IsOptional() @IsInt() @Min(1) @Max(12) selectableCount?: number;
}
