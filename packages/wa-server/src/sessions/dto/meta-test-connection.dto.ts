import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Body for the setup wizard's "Test connection" — validates Meta creds without creating a session. */
export class MetaTestConnectionDto {
  @ApiProperty({ description: 'Meta WhatsApp Phone Number ID', example: '123456789012345' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  phoneNumberId: string;

  @ApiProperty({ description: 'Permanent access token for the WhatsApp Business account' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  accessToken: string;
}
