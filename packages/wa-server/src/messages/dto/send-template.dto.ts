import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendTemplateDto {
  @ApiProperty({ description: 'Recipient phone number or JID', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Approved template name', example: 'hello_world' })
  @IsString() @IsNotEmpty() @MaxLength(512) name: string;

  @ApiProperty({ description: 'Template language code', example: 'en_US' })
  @IsString() @IsNotEmpty() @MaxLength(15) languageCode: string;

  @ApiPropertyOptional({ description: 'Body variable values for {{1}}, {{2}}, …', type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(1024, { each: true })
  bodyParams?: string[];
}
