import { IsString, IsUrl, MinLength } from 'class-validator';

export class SetWaServerDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  waServerUrl!: string;

  @IsString()
  @MinLength(1)
  waServerToken!: string;
}
