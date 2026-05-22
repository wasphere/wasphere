import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { ValidatePhoneNumberPipe } from '../common/pattern.pipe';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { UpdateProfilePictureDto } from './dto/update-profile-picture.dto';
import { CheckBulkDto } from './dto/check-bulk.dto';
import { GetProfilePictureQueryDto } from './dto/get-profile-picture-query.dto';

@ApiTags('Contacts')
@Controller('sessions/:sessionId')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  // Own profile
  @Get('profile')
  @ApiOperation({
    summary: 'Get own profile',
    description: 'Returns the WhatsApp profile of the session account including phone number, display name, and about text.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Own profile object.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getOwnProfile(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.contactsService.getOwnProfile(sid);
  }

  @Post('profile/name')
  @ApiOperation({
    summary: 'Update display name',
    description: 'Changes the WhatsApp display name shown to contacts for the session account.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Display name updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateName(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateNameDto,
  ) {
    return this.contactsService.updateName(sid, body.name);
  }

  @Post('profile/about')
  @ApiOperation({
    summary: 'Update about/status text',
    description: 'Changes the "About" status text visible on the session account\'s profile. Maximum 139 characters.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'About text updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateAbout(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateAboutDto,
  ) {
    return this.contactsService.updateAbout(sid, body.about);
  }

  @Post('profile/picture')
  @ApiOperation({
    summary: 'Update profile picture',
    description: 'Downloads an image from the given URL and sets it as the session account\'s WhatsApp profile picture.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Profile picture updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  updateProfilePicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: UpdateProfilePictureDto,
  ) {
    return this.contactsService.updateProfilePicture(sid, body.imageUrl);
  }

  @Delete('profile/picture')
  @ApiOperation({
    summary: 'Remove profile picture',
    description: '⚠️ DESTRUCTIVE: Permanently removes the session account\'s WhatsApp profile picture. Contacts will see the default avatar until a new picture is set.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Profile picture removed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  removeProfilePicture(@Param('sessionId', ValidateSessionIdPipe) sid: string) {
    return this.contactsService.removeProfilePicture(sid);
  }

  // Contact checks
  @Get('contacts/:number/check')
  @ApiOperation({
    summary: 'Check if a number is on WhatsApp',
    description: 'Queries WhatsApp servers to verify whether the given phone number has a registered WhatsApp account.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiResponse({ status: 200, description: 'Check result with exists boolean and JID if found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  checkNumber(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.checkNumber(sid, number);
  }

  @Post('contacts/check-bulk')
  @ApiOperation({
    summary: 'Check multiple numbers in bulk',
    description: 'Queries WhatsApp servers to verify whether each provided phone number has a registered account. Accepts up to 100 numbers per request.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Array of check results for each number.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  checkNumbers(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: CheckBulkDto,
  ) {
    return this.contactsService.checkNumbers(sid, body.numbers);
  }

  @Get('contacts/:number/picture')
  @ApiOperation({
    summary: 'Get a contact\'s profile picture',
    description: 'Returns the profile picture URL for the given WhatsApp number. Set highRes=true to request the full-resolution image instead of the thumbnail.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiQuery({ name: 'highRes', required: false, type: Boolean, description: 'Request full-resolution picture (default: false)' })
  @ApiResponse({ status: 200, description: 'Profile picture URL or null if not set / permission denied.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getProfilePicture(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
    @Query() query: GetProfilePictureQueryDto,
  ) {
    return this.contactsService.getProfilePicture(sid, number, query.highRes ?? false);
  }

  @Get('contacts/:number/about')
  @ApiOperation({
    summary: 'Get a contact\'s about text',
    description: 'Returns the "About" status text for the given WhatsApp number. Returns null if the contact has restricted visibility.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiResponse({ status: 200, description: 'About text string or null.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  getAbout(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.getAbout(sid, number);
  }

  @Post('contacts/:number/block')
  @ApiOperation({
    summary: 'Block a contact',
    description: 'Blocks the specified WhatsApp number. Blocked contacts cannot send messages to the session account and will not see the account\'s online status.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiResponse({ status: 201, description: 'Contact blocked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  blockContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.blockContact(sid, number);
  }

  @Post('contacts/:number/unblock')
  @ApiOperation({
    summary: 'Unblock a contact',
    description: 'Removes the block on the specified WhatsApp number, restoring normal communication.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiResponse({ status: 201, description: 'Contact unblocked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  unblockContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.unblockContact(sid, number);
  }

  @Post('contacts/:number/presence/subscribe')
  @ApiOperation({
    summary: 'Subscribe to a contact\'s presence',
    description: 'Subscribes the session to presence updates (online/offline/typing) for the specified contact. Presence events will be forwarded to the registered webhook callback.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'number', description: 'Phone number with country code (digits only)', example: '14155552671' })
  @ApiResponse({ status: 201, description: 'Presence subscription established.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  subscribePresence(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('number', ValidatePhoneNumberPipe) number: string,
  ) {
    return this.contactsService.subscribePresence(sid, number);
  }
}
