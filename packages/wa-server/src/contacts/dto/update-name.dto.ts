import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNameDto {
  @ApiProperty({ description: 'New display name (max 25 characters)', example: 'WaSphere Bot' })
  @IsString() @IsNotEmpty() @MaxLength(25) name: string;
}
