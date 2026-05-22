import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';
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
}
