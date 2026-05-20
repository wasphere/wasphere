import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUrl, MaxLength } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';

export class SendAudioDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;
  @IsOptional() @IsBoolean() isVoiceNote?: boolean;
}
