import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ConversationStatusFilter {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  SNOOZED = 'SNOOZED',
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional({ enum: ConversationStatusFilter, description: 'Filter by conversation status' })
  @IsOptional()
  @IsEnum(ConversationStatusFilter)
  status?: ConversationStatusFilter;

  @ApiPropertyOptional({ description: 'Opaque cursor (conversation id from the previous page)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size (1–100, default 30)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search contact name / phone / last message preview' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
