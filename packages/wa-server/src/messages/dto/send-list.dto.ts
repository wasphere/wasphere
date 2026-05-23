import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListRowDto {
  @ApiProperty({ description: 'Unique row ID (max 200 characters)', example: 'row_1' })
  @IsString() @IsNotEmpty() @MaxLength(200) id: string;

  @ApiProperty({ description: 'Row title shown in the list (max 24 characters)', example: 'Option A' })
  @IsString() @IsNotEmpty() @MaxLength(24) title: string;

  @ApiPropertyOptional({ description: 'Optional row description (max 72 characters)', example: 'Best for small teams' })
  @IsOptional() @IsString() @MaxLength(72) description?: string;
}

export class ListSectionDto {
  @ApiProperty({ description: 'Section header title (max 24 characters)', example: 'Plans' })
  @IsString() @IsNotEmpty() @MaxLength(24) title: string;

  @ApiProperty({ description: 'Rows in this section (1–10)', type: [ListRowDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class SendListDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'List message title (max 60 characters)', example: 'Choose your plan' })
  @IsString() @IsNotEmpty() @MaxLength(60) title: string;

  @ApiProperty({ description: 'Main message body text (max 1024 characters)', example: 'Please select an option from the list below.' })
  @IsString() @IsNotEmpty() @MaxLength(1024) text: string;

  @ApiProperty({ description: 'Label on the button that opens the list (max 20 characters)', example: 'View Options' })
  @IsString() @IsNotEmpty() @MaxLength(20) buttonText: string;

  @ApiProperty({ description: 'List sections (1–10 sections, each with 1–10 rows)', type: [ListSectionDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => ListSectionDto)
  sections: ListSectionDto[];
}
