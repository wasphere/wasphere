import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetProfilePictureQueryDto {
  @ApiPropertyOptional({ description: 'Request full-resolution image instead of thumbnail', example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  highRes?: boolean;
}
