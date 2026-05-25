import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production key', maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({
    example: ['messages:send', 'sessions:read'],
    description: 'Permission scopes. Use ["*"] for full access.',
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({
    example: 'abc123',
    description: 'Restrict key to a single session ID.',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00Z',
    description: 'Key expiry as ISO 8601 date-time string.',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
