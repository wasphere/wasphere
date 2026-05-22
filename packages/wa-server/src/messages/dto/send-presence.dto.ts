import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PresenceType {
  Available = 'available',
  Unavailable = 'unavailable',
  Composing = 'composing',
  Recording = 'recording',
  Paused = 'paused',
}

export class SendPresenceDto {
  @ApiProperty({ description: 'Chat JID to send presence to', example: '14155552671' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Presence state to broadcast', enum: PresenceType, example: PresenceType.Composing })
  @IsEnum(PresenceType) presence: PresenceType;
}
