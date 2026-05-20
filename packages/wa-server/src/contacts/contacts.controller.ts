import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { ValidatePhoneNumberPipe } from '../common/pattern.pipe';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { UpdateProfilePictureDto } from './dto/update-profile-picture.dto';
import { CheckBulkDto } from './dto/check-bulk.dto';
import { GetProfilePictureQueryDto } from './dto/get-profile-picture-query.dto';

@Controller('sessions/:sessionId')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  // Own profile
  @Get('profile')
  getOwnProfile(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.contactsService.getOwnProfile(sid);
  }

  @Post('profile/name')
  updateName(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateNameDto,
  ) {
    return this.contactsService.updateName(sid, body.name);
  }

  @Post('profile/about')
  updateAbout(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateAboutDto,
  ) {
    return this.contactsService.updateAbout(sid, body.about);
  }

  @Post('profile/picture')
  updateProfilePicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateProfilePictureDto,
  ) {
    return this.contactsService.updateProfilePicture(sid, body.imageUrl);
  }

  @Delete('profile/picture')
  removeProfilePicture(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.contactsService.removeProfilePicture(sid);
  }

  // Contact checks
  @Get('contacts/:number/check')
  checkNumber(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.checkNumber(sid, number);
  }

  @Post('contacts/check-bulk')
  checkNumbers(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: CheckBulkDto,
  ) {
    return this.contactsService.checkNumbers(sid, body.numbers);
  }

  @Get('contacts/:number/picture')
  getProfilePicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
    @Query() query: GetProfilePictureQueryDto,
  ) {
    return this.contactsService.getProfilePicture(sid, number, query.highRes ?? false);
  }

  @Get('contacts/:number/about')
  getAbout(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.getAbout(sid, number);
  }

  @Post('contacts/:number/block')
  blockContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.blockContact(sid, number);
  }

  @Post('contacts/:number/unblock')
  unblockContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.unblockContact(sid, number);
  }

  @Post('contacts/:number/presence/subscribe')
  subscribePresence(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.subscribePresence(sid, number);
  }
}
