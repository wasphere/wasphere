import { IsString, IsNotEmpty, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteMessageQueryDto {
  @ApiProperty({ description: 'Recipient JID (phone number or group JID)', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'If true, delete for everyone; if false, delete only for yourself', example: true })
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  forEveryone: boolean;
}
