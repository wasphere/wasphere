import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
  providers: [ContactsService],
  controllers: [ContactsController],
})
export class ContactsModule {}
