import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupNameDto {
  @ApiProperty({ description: 'New group name (max 100 characters)', example: 'My Updated Team Chat' })
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
}
