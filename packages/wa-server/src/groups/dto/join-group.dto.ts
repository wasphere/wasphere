import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinGroupDto {
  @ApiProperty({ description: 'WhatsApp group invite code (from the invite link)', example: 'ABC123xyz' })
  @IsString() @IsNotEmpty() @MaxLength(512) inviteCode: string;
}
