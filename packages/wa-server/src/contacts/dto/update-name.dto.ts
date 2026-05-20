import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateNameDto {
  @IsString() @IsNotEmpty() @MaxLength(25) name: string;
}
