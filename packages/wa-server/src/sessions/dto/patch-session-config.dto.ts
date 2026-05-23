import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchSessionConfigDto {
  @ApiPropertyOptional({
    description: 'Minimum anti-ban delay in milliseconds added before each outgoing message (0 = disabled).',
    example: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_min_ms?: number;

  @ApiPropertyOptional({
    description: 'Maximum anti-ban delay in milliseconds. A random value between min and max is chosen per message. Set both to 0 to disable.',
    example: 3000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_max_ms?: number;

  @ApiPropertyOptional({
    description: 'When true, incoming messages are automatically marked as read. Useful for bot sessions.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  auto_read_on_receive?: boolean;

  @ApiPropertyOptional({
    description: 'When false, incoming message events are suppressed and not forwarded to your webhook.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  receive_enabled?: boolean;
}
