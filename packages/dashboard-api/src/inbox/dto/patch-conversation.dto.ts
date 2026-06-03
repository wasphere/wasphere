import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatusFilter } from './list-conversations-query.dto';

export class PatchConversationDto {
  @ApiPropertyOptional({ enum: ConversationStatusFilter })
  @IsOptional()
  @IsEnum(ConversationStatusFilter)
  status?: ConversationStatusFilter;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the conversation tag list' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}
