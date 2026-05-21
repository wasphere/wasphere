import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AuditEventDto {
  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  actorTokenPrefix?: string;

  @IsString()
  method!: string;

  @IsString()
  endpoint!: string;

  @IsInt()
  @IsOptional()
  statusCode?: number;

  @IsString()
  @IsOptional()
  requestHash?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
