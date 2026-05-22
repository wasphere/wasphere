import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendPollDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Poll question (max 255 characters)', example: 'What is your favourite colour?' })
  @IsString() @IsNotEmpty() @MaxLength(255) name: string;

  @ApiProperty({ description: 'Poll options (2–12 options, max 100 characters each)', example: ['Red', 'Blue', 'Green'], type: [String] })
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(12)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  options: string[];

  @ApiPropertyOptional({ description: 'Maximum number of options a voter can select (1–12, default 1)', example: 1 })
  @IsOptional() @IsInt() @Min(1) @Max(12) selectableCount?: number;
}
