import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateGroupNameDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
}
