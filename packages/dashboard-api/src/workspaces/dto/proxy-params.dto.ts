import { IsUUID } from 'class-validator';

export class ProxyParamsDto {
  @IsUUID()
  id!: string;
}
