import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Body for creating a Meta message template (submitted to Meta for approval). */
export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name — lowercase letters, numbers, underscores', example: 'order_update' })
  @Matches(/^[a-z0-9_]{1,512}$/, { message: 'name must be lowercase letters, numbers and underscores only' })
  name: string;

  @ApiProperty({ description: 'Template category', enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'], example: 'UTILITY' })
  @IsIn(['UTILITY', 'MARKETING', 'AUTHENTICATION'])
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

  @ApiProperty({ description: 'BCP-47 language/locale code', example: 'en_US' })
  @Matches(/^[a-z]{2,3}(_[A-Z]{2})?$/, { message: 'language must look like "en" or "en_US"' })
  language: string;

  @ApiPropertyOptional({ description: 'Optional text header', example: 'Order update' })
  @IsOptional() @IsString() @MaxLength(60)
  headerText?: string;

  @ApiProperty({ description: 'Body text. Use {{1}}, {{2}}… for variables.', example: 'Hi {{1}}, your order {{2}} is {{3}}.' })
  @IsString() @MinLength(1) @MaxLength(1024)
  body: string;

  @ApiPropertyOptional({ description: 'Example value per {{n}} variable (required by Meta when the body has variables)', example: ['Ali', 'A123', 'shipped'] })
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  bodyExamples?: string[];

  @ApiPropertyOptional({ description: 'Optional footer text', example: 'Reply STOP to opt out' })
  @IsOptional() @IsString() @MaxLength(60)
  footer?: string;
}
