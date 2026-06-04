import { Controller, Post, Body, Param, Delete, Query, UseGuards, Get, HttpCode } from '@nestjs/common';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { ValidateMessageIdPipe } from '../common/pattern.pipe';
import { SendTextDto } from './dto/send-text.dto';
import { SendMediaDto, SendStickerDto } from './dto/send-media.dto';
import { SendAudioDto } from './dto/send-audio.dto';
import { SendDocumentDto } from './dto/send-document.dto';
import { SendLocationDto } from './dto/send-location.dto';
import { SendContactDto } from './dto/send-contact.dto';
import { SendButtonsDto } from './dto/send-buttons.dto';
import { SendListDto } from './dto/send-list.dto';
import { SendPollDto } from './dto/send-poll.dto';
import { SendReactionDto } from './dto/send-reaction.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageQueryDto } from './dto/delete-message-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { SendTypingDto } from './dto/send-typing.dto';
import { SendPresenceDto } from './dto/send-presence.dto';
import { BulkMessageDto } from './dto/bulk-message.dto';
import { BulkJob } from './bulk-message.types';

@ApiTags('Messages')
@Controller('sessions/:sessionId/messages')
@UseGuards(RateLimitGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('text')
  @ApiOperation({
    summary: 'Send a text message',
    description: 'Sends a plain text message to a WhatsApp number or group JID. Optionally quote an existing message by providing its ID.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Message sent. Returns the message key.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 422, description: 'Recipient not on WhatsApp.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendText(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendTextDto,
  ) {
    return this.messagesService.sendText(sid, body.to, body.text, body.quotedId);
  }

  @Post('image')
  @ApiOperation({
    summary: 'Send an image message',
    description: 'Downloads the image from the provided URL and sends it as a WhatsApp image message. Supports an optional caption.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Image message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 422, description: 'Recipient not on WhatsApp or URL unreachable.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendImage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendImage(sid, body.to, body.url, body.caption);
  }

  @Post('video')
  @ApiOperation({
    summary: 'Send a video message',
    description: 'Downloads the video from the provided URL and sends it as a WhatsApp video message. Supports an optional caption.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Video message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 422, description: 'Recipient not on WhatsApp or URL unreachable.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendVideo(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendVideo(sid, body.to, body.url, body.caption);
  }

  @Post('audio')
  @ApiOperation({
    summary: 'Send an audio message',
    description: 'Sends an audio file from the given URL. Set isVoiceNote to true to display the message as a voice note with a waveform UI instead of a file attachment.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Audio message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendAudio(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendAudioDto,
  ) {
    return this.messagesService.sendAudio(sid, body.to, body.url, body.isVoiceNote);
  }

  @Post('document')
  @ApiOperation({
    summary: 'Send a document message',
    description: 'Downloads a file from the given URL and sends it as a WhatsApp document. The fileName and mimetype fields control how the file is displayed in the chat.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Document message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendDocument(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendDocumentDto,
  ) {
    return this.messagesService.sendDocument(sid, body.to, body.url, body.fileName, body.mimetype);
  }

  @Post('sticker')
  @ApiOperation({
    summary: 'Send a sticker message',
    description: 'Downloads an image from the given URL, converts it to a WebP sticker, and sends it to the recipient.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Sticker message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendSticker(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendStickerDto,
  ) {
    return this.messagesService.sendSticker(sid, body.to, body.url);
  }

  @Post('location')
  @ApiOperation({
    summary: 'Send a location message',
    description: 'Sends a map pin with the given latitude and longitude. Optional name and address fields are displayed as a label below the pin.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Location message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendLocation(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendLocationDto,
  ) {
    return this.messagesService.sendLocation(sid, body.to, body.latitude, body.longitude, body.name, body.address);
  }

  @Post('contact')
  @ApiOperation({
    summary: 'Send a contact card',
    description: 'Sends a vCard contact card with the provided display name and phone number to the recipient.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Contact card sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendContactDto,
  ) {
    return this.messagesService.sendContact(sid, body.to, body.displayName, body.phoneNumber);
  }

  @Post('buttons')
  @ApiOperation({
    summary: 'Send a buttons message',
    description: 'Sends an interactive message with up to 3 quick-reply buttons. Button availability depends on the WhatsApp client version of the recipient.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Buttons message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendButtons(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendButtonsDto,
  ) {
    return this.messagesService.sendButtons(sid, body.to, body.text, body.footer, body.buttons);
  }

  @Post('list')
  @ApiOperation({
    summary: 'Send a list message',
    description: 'Sends an interactive list message with sections and selectable rows. The recipient taps a button to open the list picker.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'List message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendList(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendListDto,
  ) {
    return this.messagesService.sendList(sid, body.to, body.title, body.text, body.buttonText, body.sections);
  }

  @Post('poll')
  @ApiOperation({
    summary: 'Send a poll',
    description: 'Sends a WhatsApp poll with 2–12 options. selectableCount controls how many options a recipient may choose; defaults to 1 (single choice).',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Poll sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendPoll(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendPollDto,
  ) {
    return this.messagesService.sendPoll(sid, body.to, body.name, body.options, body.selectableCount);
  }

  @Post('reaction')
  @ApiOperation({
    summary: 'React to a message',
    description: 'Sends an emoji reaction to the specified message. Send an empty string as emoji to remove an existing reaction.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Reaction sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendReaction(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendReactionDto,
  ) {
    return this.messagesService.sendReaction(sid, body.to, body.messageId, body.emoji, body.fromMe);
  }

  @Post('gif')
  @ApiOperation({
    summary: 'Send a GIF message',
    description: 'Downloads a video file from the given URL and sends it as a looping GIF in the WhatsApp chat. Supports an optional caption.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'GIF message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendGif(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendGif(sid, body.to, body.url, body.caption);
  }

  @Post('view-once')
  @ApiOperation({
    summary: 'Send a view-once media message',
    description: 'Sends an image or video that can only be viewed once by the recipient. After opening, the media is permanently removed from the chat.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'View-once message sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendViewOnce(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendViewOnce(sid, body.to, body.url, body.caption);
  }

  @Post(':messageId/edit')
  @ApiOperation({
    summary: 'Edit a sent message',
    description: 'Replaces the text of a previously sent message. Only the original sender can edit a message, and editing is subject to WhatsApp time limits.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'messageId', description: 'ID of the message to edit', example: 'ABCDEF1234567890' })
  @ApiResponse({ status: 200, description: 'Message edited.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or message not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  editMessage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('messageId', ValidateMessageIdPipe) messageId: string,
    @Body() body: EditMessageDto,
  ) {
    return this.messagesService.editMessage(sid, body.to, messageId, body.text);
  }

  @Delete(':messageId')
  @ApiOperation({
    summary: 'Delete a message',
    description: '⚠️ DESTRUCTIVE: Deletes a sent message. If forEveryone=true, the message is recalled for all participants (subject to WhatsApp time limits). If false, it is deleted only for the session account.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'messageId', description: 'ID of the message to delete', example: 'ABCDEF1234567890' })
  @ApiResponse({ status: 200, description: 'Message deleted.' })
  @ApiResponse({ status: 400, description: 'Malformed query parameters.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session or message not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  deleteMessage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('messageId', ValidateMessageIdPipe) messageId: string,
    @Query() query: DeleteMessageQueryDto,
  ) {
    return this.messagesService.deleteMessage(sid, query.to, messageId, query.forEveryone);
  }

  @Post('read')
  @ApiOperation({
    summary: 'Mark messages as read',
    description: 'Sends read receipts for one or more messages in a chat, updating the double-tick status for the sender.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Read receipts sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  markRead(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: MarkReadDto,
  ) {
    return this.messagesService.markRead(sid, body.to, body.messageIds);
  }

  @Post('typing')
  @ApiOperation({
    summary: 'Send a typing indicator',
    description: 'Broadcasts a composing (typing) status to the specified chat. The indicator clears automatically after a few seconds.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Typing indicator sent.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendTyping(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendTypingDto,
  ) {
    return this.messagesService.sendTyping(sid, body.to, body.isGroup);
  }

  @Post('presence')
  @ApiOperation({
    summary: 'Update presence status',
    description: 'Sets the session account\'s presence status (available, unavailable, composing, recording, paused) visible to the specified contact.',
  })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 201, description: 'Presence status updated.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  sendPresence(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendPresenceDto,
  ) {
    return this.messagesService.sendPresence(sid, body.to, body.presence);
  }

  @Post('bulk')
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a bulk send job' })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 202, description: 'Bulk job accepted. Returns jobId and total recipient count.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 409, description: 'A bulk job is already running for this session.' })
  async startBulk(
    @Param('sessionId', ValidateSessionIdPipe) sessionId: string,
    @Body() body: BulkMessageDto,
  ): Promise<{ jobId: string; total: number }> {
    return this.messagesService.startBulkJob(sessionId, body);
  }

  @Get('bulk/:jobId')
  @ApiOperation({ summary: 'Get bulk job status' })
  @ApiParam({ name: 'sessionId', description: 'Session identifier', example: 'my-session' })
  @ApiParam({ name: 'jobId', description: 'Bulk job UUID returned by POST /bulk' })
  @ApiResponse({ status: 200, description: 'Bulk job status and per-recipient outcomes.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  getBulkStatus(
    @Param('sessionId', ValidateSessionIdPipe) sessionId: string,
    @Param('jobId') jobId: string,
  ): BulkJob {
    return this.messagesService.getBulkJobStatus(sessionId, jobId);
  }
}
