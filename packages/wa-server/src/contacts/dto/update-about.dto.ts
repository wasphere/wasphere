import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAboutDto {
  @ApiProperty({ description: 'New "About" status text (max 139 characters)', example: 'Hey there! I am using WhatsApp.' })
  @IsString() @MaxLength(139) about: string;
}
