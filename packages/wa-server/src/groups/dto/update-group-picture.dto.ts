import { IsUrl, MaxLength } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupPictureDto {
  @ApiProperty({ description: 'Publicly accessible URL of the new group picture (HTTPS recommended)', example: 'https://example.com/group-icon.jpg' })
  @IsUrl(URL_OPTIONS) @MaxLength(2048) imageUrl: string;
}
