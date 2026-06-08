import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule], // CombinedAuthGuard needs ApiKeysService
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
