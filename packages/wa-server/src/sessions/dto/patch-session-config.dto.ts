import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchSessionConfigDto {
  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_min_ms?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_max_ms?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  auto_read_on_receive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  receive_enabled?: boolean;
}
