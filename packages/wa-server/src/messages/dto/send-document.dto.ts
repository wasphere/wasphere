import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { IsUrlOrDataUri } from '../../common/validators';
import { ApiProperty } from '@nestjs/swagger';

export class SendDocumentDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Publicly accessible URL of the document or base64 data URI', example: 'https://example.com/report.pdf' })
  @IsUrlOrDataUri() @MaxLength(10_485_760) url: string;

  @ApiProperty({ description: 'File name shown to the recipient (max 255 characters)', example: 'Q1-Report.pdf' })
  @IsString() @IsNotEmpty() @MaxLength(255) fileName: string;

  @ApiProperty({ description: 'MIME type of the document (e.g. application/pdf)', example: 'application/pdf' })
  @IsString() @IsNotEmpty() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/) @MaxLength(127) mimetype: string;
}
