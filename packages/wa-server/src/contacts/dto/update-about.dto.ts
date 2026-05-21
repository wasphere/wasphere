import { IsString, MaxLength } from 'class-validator';

export class UpdateAboutDto {
  @IsString() @MaxLength(139) about: string;
}
