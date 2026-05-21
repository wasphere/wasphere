import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1024)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  participants: string[];
}
