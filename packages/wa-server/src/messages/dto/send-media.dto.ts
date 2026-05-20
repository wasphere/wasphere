import { IsString, IsNotEmpty, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';

export class SendMediaDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;
  @IsOptional() @IsString() @MaxLength(1024) caption?: string;
}

export class SendStickerDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;
}
