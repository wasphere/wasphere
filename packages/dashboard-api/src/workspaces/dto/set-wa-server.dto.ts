import { IsString, IsUrl, MinLength } from 'class-validator';

export class SetWaServerDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  waServerUrl!: string;

  @IsString()
  @MinLength(1)
  waServerToken!: string;
}
