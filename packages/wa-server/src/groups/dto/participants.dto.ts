import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParticipantsDto {
  @ApiProperty({ description: 'Phone numbers of participants (with country code, max 500)', example: ['14155552671', '447911123456'], type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  participants: string[];
}
