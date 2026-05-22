import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name (max 100 characters)', example: 'My Team Chat' })
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;

  @ApiProperty({ description: 'Phone numbers of initial participants (with country code, max 1024)', example: ['14155552671', '447911123456'], type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1024)
  @IsString({ each: true }) @MaxLength(40, { each: true })
  participants: string[];
}
