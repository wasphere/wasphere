import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkMessageTextDto {
  @ApiProperty({ example: 'Hello from WaSphere!', maxLength: 65536 })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class BulkMessageDto {
  @ApiProperty({
    description: 'Array of WhatsApp JIDs (individual or group) — no duplicates',
    example: ['1234567890@s.whatsapp.net', '112233445566-1609459200@g.us'],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^(\d{6,20}@s\.whatsapp\.net|\d{6,20}-\d{10,20}@g\.us)$/, {
    each: true,
    message: 'Each recipient must be a valid WhatsApp JID (e.g. 1234567890@s.whatsapp.net or 1234567890-1609459200@g.us)',
  })
  recipients: string[];

  @ApiProperty({ description: 'Message content — text only in v1.0' })
  @IsObject()
  @ValidateNested()
  @Type(() => BulkMessageTextDto)
  message: BulkMessageTextDto;

  @ApiPropertyOptional({
    description: 'Delay between sends in milliseconds',
    minimum: 1000,
    maximum: 10000,
    default: 1000,
  })
  @IsInt()
  @Min(1000)
  @Max(10000)
  delayMs: number = 1000;
}
