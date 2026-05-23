import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendLocationDto {
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Latitude in decimal degrees (-90 to 90)', example: 37.7749 })
  @IsNumber() @Min(-90) @Max(90) latitude: number;

  @ApiProperty({ description: 'Longitude in decimal degrees (-180 to 180)', example: -122.4194 })
  @IsNumber() @Min(-180) @Max(180) longitude: number;

  @ApiPropertyOptional({ description: 'Location name shown to the recipient (max 255 characters)', example: 'San Francisco' })
  @IsOptional() @IsString() @MaxLength(255) name?: string;

  @ApiPropertyOptional({ description: 'Street address shown to the recipient (max 512 characters)', example: '1 Market St, San Francisco, CA 94105' })
  @IsOptional() @IsString() @MaxLength(512) address?: string;
}
