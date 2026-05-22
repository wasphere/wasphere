import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupDescriptionDto {
  @ApiProperty({ description: 'New group description (max 512 characters)', example: 'This group is for team announcements.' })
  @IsString() @MaxLength(512) description: string;
}
