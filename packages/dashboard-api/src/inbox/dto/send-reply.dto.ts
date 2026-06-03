import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type ReplyKind = 'text' | 'image' | 'document' | 'poll';

/**
 * Outbound inbox reply. `kind` selects the message type; the remaining fields
 * are conditionally required per kind (validated at the boundary). Media is
 * passed as a base64 data URI and proxied to the WA server's send endpoints.
 */
export class SendReplyDto {
  @ApiPropertyOptional({ enum: ['text', 'image', 'document', 'poll'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'image', 'document', 'poll'])
  kind?: ReplyKind;

  // text (required only for text replies)
  @ApiPropertyOptional({ description: 'Reply text', maxLength: 4096 })
  @ValidateIf((o) => (o.kind ?? 'text') === 'text')
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text?: string;

  // image | document — base64 data URI (e.g. "data:image/png;base64,...")
  @ApiPropertyOptional({ description: 'Base64 data URI of the media (image or document)' })
  @ValidateIf((o) => o.kind === 'image' || o.kind === 'document')
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_485_760)
  media?: string;

  @ApiPropertyOptional({ description: 'Image caption', maxLength: 1024 })
  @ValidateIf((o) => o.kind === 'image')
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @ApiPropertyOptional({ description: 'Document file name', maxLength: 255 })
  @ValidateIf((o) => o.kind === 'document')
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Document MIME type', maxLength: 127 })
  @ValidateIf((o) => o.kind === 'document')
  @IsString()
  @IsNotEmpty()
  @MaxLength(127)
  mimetype?: string;

  // poll
  @ApiPropertyOptional({ description: 'Poll question', maxLength: 255 })
  @ValidateIf((o) => o.kind === 'poll')
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pollName?: string;

  @ApiPropertyOptional({ description: 'Poll options (2–12)', type: [String] })
  @ValidateIf((o) => o.kind === 'poll')
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];
}
