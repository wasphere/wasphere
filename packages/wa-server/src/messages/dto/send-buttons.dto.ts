import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ButtonItemDto {
  @IsString() @IsNotEmpty() @MaxLength(20) id: string;
  @IsString() @IsNotEmpty() @MaxLength(20) text: string;
}

export class SendButtonsDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(1024) text: string;
  @IsString() @IsNotEmpty() @MaxLength(60) footer: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => ButtonItemDto)
  buttons: ButtonItemDto[];
}
