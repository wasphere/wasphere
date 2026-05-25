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
  @ApiProperty({ description: 'Recipient phone number with country code (e.g. 923001234567) or full WhatsApp JID (e.g. 923001234567@s.whatsapp.net). Both formats are accepted.', example: '923001234567' })
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;

  @ApiProperty({ description: 'Presence state to broadcast', enum: PresenceType, example: PresenceType.Composing })
  @IsEnum(PresenceType) presence: PresenceType;
}
