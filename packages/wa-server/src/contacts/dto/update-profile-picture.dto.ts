import { IsUrl, MaxLength } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';

export class UpdateProfilePictureDto {
  @IsUrl(URL_OPTIONS) @MaxLength(2048) imageUrl: string;
}
