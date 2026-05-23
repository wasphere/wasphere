import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ example: 'Staging key', maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: ['messages:send'],
    description: 'Replace permission scopes. Use ["*"] for full access.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({ example: false, description: 'Activate or deactivate the key.' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'abc123',
    description: 'Restrict key to a single session ID. Pass null to remove restriction.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  sessionId?: string | null;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00Z',
    description: 'Update expiry. Pass null to remove expiry.',
    nullable: true,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}
