import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandingDto {
  @ApiPropertyOptional({
    description: 'Custom dashboard logo as a base64 image data URI (png/jpeg/webp/svg/gif). Empty string removes it. ~500KB max.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(700000)
  logo?: string;

  @ApiPropertyOptional({ description: 'Workspace display name.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
