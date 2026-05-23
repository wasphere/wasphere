import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrlOrDataUri } from '../../common/validators';

export class SendAudioDto {
  @ApiProperty({ description: 'Recipient WhatsApp JID or phone number with country code', example: '14155552671@s.whatsapp.net', maxLength: 40 })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the audio file or base64 data URI', example: 'https://example.com/audio.mp3' })
  @IsUrlOrDataUri() @MaxLength(10_485_760) url: string;

  @ApiPropertyOptional({ description: 'When true, the audio is sent as a voice note with waveform UI instead of a file attachment', example: false })
  @IsOptional() @IsBoolean() isVoiceNote?: boolean;
}
