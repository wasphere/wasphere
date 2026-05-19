import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';

@Controller('sessions/:sessionId')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  // Own profile
  @Get('profile')
  getOwnProfile(@Param('sessionId') sid: string) {
    return this.contactsService.getOwnProfile(sid);
  }

  @Post('profile/name')
  updateName(@Param('sessionId') sid: string, @Body() body: { name: string }) {
    return this.contactsService.updateName(sid, body.name);
  }

  @Post('profile/about')
  updateAbout(@Param('sessionId') sid: string, @Body() body: { about: string }) {
    return this.contactsService.updateAbout(sid, body.about);
  }

  @Post('profile/picture')
  updateProfilePicture(@Param('sessionId') sid: string, @Body() body: { imageUrl: string }) {
    return this.contactsService.updateProfilePicture(sid, body.imageUrl);
  }

  @Delete('profile/picture')
  removeProfilePicture(@Param('sessionId') sid: string) {
    return this.contactsService.removeProfilePicture(sid);
  }

  // Contact checks
  @Get('contacts/:number/check')
  checkNumber(@Param('sessionId') sid: string, @Param('number') number: string) {
    return this.contactsService.checkNumber(sid, number);
  }

  @Post('contacts/check-bulk')
  checkNumbers(@Param('sessionId') sid: string, @Body() body: { numbers: string[] }) {
    return this.contactsService.checkNumbers(sid, body.numbers);
  }

  @Get('contacts/:number/picture')
  getProfilePicture(
    @Param('sessionId') sid: string,
    @Param('number') number: string,
    @Query('highRes') highRes: string,
  ) {
    return this.contactsService.getProfilePicture(sid, number, highRes === 'true');
  }

  @Get('contacts/:number/about')
  getAbout(@Param('sessionId') sid: string, @Param('number') number: string) {
    return this.contactsService.getAbout(sid, number);
  }

  @Post('contacts/:number/block')
  blockContact(@Param('sessionId') sid: string, @Param('number') number: string) {
    return this.contactsService.blockContact(sid, number);
  }

  @Post('contacts/:number/unblock')
  unblockContact(@Param('sessionId') sid: string, @Param('number') number: string) {
    return this.contactsService.unblockContact(sid, number);
  }

  @Post('contacts/:number/presence/subscribe')
  subscribePresence(@Param('sessionId') sid: string, @Param('number') number: string) {
    return this.contactsService.subscribePresence(sid, number);
  }
}
