import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, MaxLength } from 'class-validator';

export class ParticipantsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  participants: string[];
}
