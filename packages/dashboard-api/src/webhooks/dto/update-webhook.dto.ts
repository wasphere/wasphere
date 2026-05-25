import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'Staging alerts', maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://staging.example.com/webhook' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({
    example: ['message.sent'],
    description: 'Replace event subscriptions. Use ["*"] for all events.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  retryMax?: number;
}
