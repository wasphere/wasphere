import { Module } from '@nestjs/common';
import { AuditMiddleware } from './audit.middleware';

@Module({
  providers: [AuditMiddleware],
})
export class AuditModule {}
