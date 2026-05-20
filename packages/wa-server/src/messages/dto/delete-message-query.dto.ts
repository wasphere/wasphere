import { IsString, IsNotEmpty, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class DeleteMessageQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  forEveryone: boolean;
}
