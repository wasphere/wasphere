import { IsString, MaxLength } from 'class-validator';

export class UpdateGroupDescriptionDto {
  @IsString() @MaxLength(512) description: string;
}
