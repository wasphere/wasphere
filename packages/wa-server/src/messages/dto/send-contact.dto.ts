import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class SendContactDto {
  @IsString() @IsNotEmpty() @MaxLength(40) to: string;
  @IsString() @IsNotEmpty() @MaxLength(100)
  @Matches(/^[\w\s\+\-\(\)\.,]+$/u, { message: 'displayName contains disallowed characters' })
  displayName: string;
  @IsString() @IsNotEmpty() @MaxLength(30)
  @Matches(/^[\d\+\-\s]+$/, { message: 'phoneNumber must contain only digits, +, -, and spaces' })
  phoneNumber: string;
}
