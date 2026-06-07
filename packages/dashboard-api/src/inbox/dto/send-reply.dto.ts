import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type ReplyKind =
  | 'text'
  | 'image'
  | 'document'
  | 'poll'
  | 'reaction'
  | 'location'
  | 'contact'
  | 'buttons'
  | 'list';

const KINDS: ReplyKind[] = ['text', 'image', 'document', 'poll', 'reaction', 'location', 'contact', 'buttons', 'list'];

/**
 * Outbound inbox reply. `kind` selects the message type; the remaining fields
 * are conditionally required per kind (validated at the boundary). Media is
 * passed as a base64 data URI and proxied to the WA server's send endpoints.
 */
export class SendReplyDto {
  @ApiPropertyOptional({ enum: KINDS, default: 'text' })
  @IsOptional()
  @IsIn(KINDS)
  kind?: ReplyKind;

  // text — required for text replies AND the body of buttons/list messages
  @ApiPropertyOptional({ description: 'Reply / body text', maxLength: 4096 })
  @ValidateIf((o) => ['text', 'buttons', 'list'].includes(o.kind ?? 'text'))
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

  @ApiPropertyOptional({ description: 'Max selectable poll options (1 = single choice, default)' })
  @ValidateIf((o) => o.kind === 'poll')
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  selectableCount?: number;

  // reaction — WA message id to react to + the emoji (empty string clears it)
  @ApiPropertyOptional({ description: 'WA message id to react to' })
  @ValidateIf((o) => o.kind === 'reaction')
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  targetMessageId?: string;

  @ApiPropertyOptional({ description: 'Reaction emoji ("" clears)' })
  @ValidateIf((o) => o.kind === 'reaction')
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @ApiPropertyOptional({ description: 'True if reacting to a message we sent (outbound)' })
  @ValidateIf((o) => o.kind === 'reaction')
  @IsOptional()
  @IsBoolean()
  targetFromMe?: boolean;

  // location
  @ApiPropertyOptional({ description: 'Latitude (location)' })
  @ValidateIf((o) => o.kind === 'location')
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude (location)' })
  @ValidateIf((o) => o.kind === 'location')
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Location label' })
  @ValidateIf((o) => o.kind === 'location')
  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @ApiPropertyOptional({ description: 'Location address' })
  @ValidateIf((o) => o.kind === 'location')
  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  // contact
  @ApiPropertyOptional({ description: 'Contact display name' })
  @ValidateIf((o) => o.kind === 'contact')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @ValidateIf((o) => o.kind === 'contact')
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  contactPhone?: string;

  // buttons — `text` is the body; footer + up to 3 reply buttons
  @ApiPropertyOptional({ description: 'Buttons footer' })
  @ValidateIf((o) => o.kind === 'buttons')
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  footer?: string;

  @ApiPropertyOptional({ description: 'Reply buttons (1–3): [{ id, text }]' })
  @ValidateIf((o) => o.kind === 'buttons')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  buttons?: { id: string; text: string }[];

  // list — `text` is the body
  @ApiPropertyOptional({ description: 'List header title' })
  @ValidateIf((o) => o.kind === 'list')
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  listTitle?: string;

  @ApiPropertyOptional({ description: 'List button label' })
  @ValidateIf((o) => o.kind === 'list')
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  buttonText?: string;

  @ApiPropertyOptional({ description: 'List sections: [{ title, rows: [{ id, title, description? }] }]' })
  @ValidateIf((o) => o.kind === 'list')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[];
}
