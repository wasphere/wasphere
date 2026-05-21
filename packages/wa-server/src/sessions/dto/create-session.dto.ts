import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'id may only contain letters, numbers, hyphens and underscores',
  })
  id: string;
}
