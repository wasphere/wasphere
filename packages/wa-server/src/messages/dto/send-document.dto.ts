import { IsString, IsNotEmpty, IsUrl, MaxLength, Matches } from 'class-validator';
import { URL_OPTIONS } from '../../common/validators';

export class SendDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsUrl(URL_OPTIONS) @MaxLength(2048) url: string;
  @IsString() @IsNotEmpty() @MaxLength(255) fileName: string;
  @IsString() @IsNotEmpty() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/) @MaxLength(127) mimetype: string;
}
