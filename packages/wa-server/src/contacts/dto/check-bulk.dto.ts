import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckBulkDto {
  @ApiProperty({ description: 'Phone numbers with country code (digits only, max 40 chars each)', example: ['14155552671', '447911123456'], type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  numbers: string[];
}
