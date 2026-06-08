import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global so AuthService and TeamService can inject MailService without each
// feature module having to import MailModule.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
