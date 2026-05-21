import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetProfilePictureQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  highRes?: boolean;
}
