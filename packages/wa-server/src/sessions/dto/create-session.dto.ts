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
  @Max(300000)
  random_delay_min_ms?: number;

  @ApiPropertyOptional({
    description: 'Maximum anti-ban delay in milliseconds. The server picks a random value between random_delay_min_ms and this value before sending. Set both to 0 to disable delay entirely.',
    example: 3000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
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
    description: 'Maximum outgoing messages per rolling 60 seconds for this session (0 = unlimited). An anti-ban throughput cap — the server paces sends so this rate is never exceeded.',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  max_messages_per_minute?: number;

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

  // ── Meta Cloud API credentials (required when provider = 'meta') ──────────

  @ApiPropertyOptional({ description: 'Meta WhatsApp Phone Number ID (provider=meta).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  metaPhoneNumberId?: string;

  @ApiPropertyOptional({ description: 'Meta permanent access token (provider=meta).' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  metaAccessToken?: string;

  @ApiPropertyOptional({ description: 'Meta WhatsApp Business Account ID (provider=meta).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  metaWabaId?: string;

  @ApiPropertyOptional({ description: 'Webhook verify token you choose (provider=meta).' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  metaVerifyToken?: string;

  @ApiPropertyOptional({ description: 'Meta app secret for webhook signature verification (provider=meta; required in production).' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  metaAppSecret?: string;
}
