import { IsUrl, MaxLength } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfilePictureDto {
  @ApiProperty({ description: 'Publicly accessible URL of the new profile picture (HTTPS recommended)', example: 'https://example.com/avatar.jpg' })
  @IsUrl(URL_OPTIONS) @MaxLength(2048) imageUrl: string;
}
