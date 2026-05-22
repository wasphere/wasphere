import { IsOptional, IsInt, Min, Max, IsISO8601, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAuditLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;
}
