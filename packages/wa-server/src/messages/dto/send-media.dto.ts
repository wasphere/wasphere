import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrlOrDataUri } from '../../common/validators';

export class SendMediaDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the media file or base64 data URI', example: 'https://example.com/image.jpg' })
  @IsUrlOrDataUri() @MaxLength(10_485_760) url: string;

  @ApiPropertyOptional({ description: 'Optional caption text displayed below the media', example: 'Check this out!', maxLength: 1024 })
  @IsOptional() @IsString() @MaxLength(1024) caption?: string;
}

export class SendStickerDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the sticker image (will be converted to WebP) or base64 data URI', example: 'https://example.com/sticker.png' })
  @IsUrlOrDataUri() @MaxLength(10_485_760) url: string;
}
