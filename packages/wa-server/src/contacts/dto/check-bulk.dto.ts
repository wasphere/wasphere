import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, MaxLength } from 'class-validator';

export class CheckBulkDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  numbers: string[];
}
