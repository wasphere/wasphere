import { IsString, IsNotEmpty, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { URL_OPTIONS } from '../../common/validators';

export class SendMediaDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the media file', example: 'https://example.com/image.jpg', maxLength: 2048 })
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;

  @ApiPropertyOptional({ description: 'Optional caption text displayed below the media', example: 'Check this out!', maxLength: 1024 })
  @IsOptional() @IsString() @MaxLength(1024) caption?: string;
}

export class SendStickerDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the sticker image (will be converted to WebP)', example: 'https://example.com/sticker.png', maxLength: 2048 })
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;
}
