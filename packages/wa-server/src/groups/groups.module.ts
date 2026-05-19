import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  providers: [GroupsService],
  controllers: [GroupsController],
})
export class GroupsModule {}
