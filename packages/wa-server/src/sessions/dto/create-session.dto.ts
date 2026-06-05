import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches, IsInt, Min, Max, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Unique session identifier. Alphanumeric, hyphens, and underscores only.',
    example: 'my-session',
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'id may only contain letters, numbers, hyphens and underscores',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Optional proxy URL (http://, https://, socks5://). No embedded credentials. To change a proxy, delete and re-create the session.',
    example: 'socks5://10.0.0.5:1080',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(https?|socks5):\/\/[^\s@\/]+(\:[0-9]{1,5})?(\/.*)?$/, {
    message: 'proxy must be a valid http://, https://, or socks5:// URL without embedded credentials',
  })
  proxy?: string;

  @ApiPropertyOptional({
    description: 'Minimum anti-ban delay in milliseconds added before each outgoing message (0 = disabled). Combine with random_delay_max_ms for a randomised range, e.g. 1000–3000 ms mimics human typing pace.',
    example: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_min_ms?: number;

  @ApiPropertyOptional({
    description: 'Maximum anti-ban delay in milliseconds. The server picks a random value between random_delay_min_ms and this value before sending. Set both to 0 to disable delay entirely.',
    example: 3000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  random_delay_max_ms?: number;

  @ApiPropertyOptional({
    description: 'When true, incoming messages are automatically marked as read as soon as they are received. Useful for bot sessions; leave false for human-operated sessions.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  auto_read_on_receive?: boolean;

  @ApiPropertyOptional({
    description: 'When false, the session will not emit incoming message events to your webhook. Useful for send-only sessions to reduce webhook noise.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  receive_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'WhatsApp engine for this session. "baileys" (default) uses the unofficial web protocol via QR. "meta" (official Cloud API) lands in a later release.',
    enum: ['baileys', 'meta'],
    default: 'baileys',
  })
  @IsOptional()
  @IsIn(['baileys', 'meta'])
  provider?: 'baileys' | 'meta';

  @ApiPropertyOptional({
    description: 'Optional backup provider used for opt-in send failover (failover behaviour is wired in a later release).',
    enum: ['baileys', 'meta'],
  })
  @IsOptional()
  @IsIn(['baileys', 'meta'])
  fallbackProvider?: 'baileys' | 'meta';
}
