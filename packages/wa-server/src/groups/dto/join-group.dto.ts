import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class JoinGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(512) inviteCode: string;
}
