import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';

export enum PresenceType {
  Available = 'available',
  Unavailable = 'unavailable',
  Composing = 'composing',
  Recording = 'recording',
  Paused = 'paused',
}

export class SendPresenceDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsEnum(PresenceType) presence: PresenceType;
}
