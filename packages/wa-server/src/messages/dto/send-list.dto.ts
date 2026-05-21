import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRowDto {
  @IsString() @IsNotEmpty() @MaxLength(200) id: string;
  @IsString() @IsNotEmpty() @MaxLength(24) title: string;
  @IsOptional() @IsString() @MaxLength(72) description?: string;
}

export class ListSectionDto {
  @IsString() @IsNotEmpty() @MaxLength(24) title: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class SendListDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(60) title: string;
  @IsString() @IsNotEmpty() @MaxLength(1024) text: string;
  @IsString() @IsNotEmpty() @MaxLength(20) buttonText: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => ListSectionDto)
  sections: ListSectionDto[];
}
