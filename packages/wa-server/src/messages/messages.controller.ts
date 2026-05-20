import { Controller, Post, Body, Param, Delete, Query } from '@nestjs/common';
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

@Controller('sessions/:sessionId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('text')
  sendText(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendTextDto,
  ) {
    return this.messagesService.sendText(sid, body.to, body.text, body.quotedId);
  }

  @Post('image')
  sendImage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendImage(sid, body.to, body.url, body.caption);
  }

  @Post('video')
  sendVideo(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendVideo(sid, body.to, body.url, body.caption);
  }

  @Post('audio')
  sendAudio(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendAudioDto,
  ) {
    return this.messagesService.sendAudio(sid, body.to, body.url, body.isVoiceNote);
  }

  @Post('document')
  sendDocument(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendDocumentDto,
  ) {
    return this.messagesService.sendDocument(sid, body.to, body.url, body.fileName, body.mimetype);
  }

  @Post('sticker')
  sendSticker(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendStickerDto,
  ) {
    return this.messagesService.sendSticker(sid, body.to, body.url);
  }

  @Post('location')
  sendLocation(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendLocationDto,
  ) {
    return this.messagesService.sendLocation(sid, body.to, body.latitude, body.longitude, body.name, body.address);
  }

  @Post('contact')
  sendContact(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendContactDto,
  ) {
    return this.messagesService.sendContact(sid, body.to, body.displayName, body.phoneNumber);
  }

  @Post('buttons')
  sendButtons(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendButtonsDto,
  ) {
    return this.messagesService.sendButtons(sid, body.to, body.text, body.footer, body.buttons);
  }

  @Post('list')
  sendList(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendListDto,
  ) {
    return this.messagesService.sendList(sid, body.to, body.title, body.text, body.buttonText, body.sections);
  }

  @Post('poll')
  sendPoll(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendPollDto,
  ) {
    return this.messagesService.sendPoll(sid, body.to, body.name, body.options, body.selectableCount);
  }

  @Post('reaction')
  sendReaction(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendReactionDto,
  ) {
    return this.messagesService.sendReaction(sid, body.to, body.messageId, body.emoji);
  }

  @Post('gif')
  sendGif(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendGif(sid, body.to, body.url, body.caption);
  }

  @Post('view-once')
  sendViewOnce(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendMediaDto,
  ) {
    return this.messagesService.sendViewOnce(sid, body.to, body.url, body.caption);
  }

  @Post(':messageId/edit')
  editMessage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('messageId', ValidateMessageIdPipe) messageId: string,
    @Body() body: EditMessageDto,
  ) {
    return this.messagesService.editMessage(sid, body.to, messageId, body.text);
  }

  @Delete(':messageId')
  deleteMessage(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Param('messageId', ValidateMessageIdPipe) messageId: string,
    @Query() query: DeleteMessageQueryDto,
  ) {
    return this.messagesService.deleteMessage(sid, query.to, messageId, query.forEveryone);
  }

  @Post('read')
  markRead(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: MarkReadDto,
  ) {
    return this.messagesService.markRead(sid, body.to, body.messageIds);
  }

  @Post('typing')
  sendTyping(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendTypingDto,
  ) {
    return this.messagesService.sendTyping(sid, body.to, body.isGroup);
  }

  @Post('presence')
  sendPresence(
    @Param('sessionId', ValidateSessionIdPipe) sid: string,
    @Body() body: SendPresenceDto,
  ) {
    return this.messagesService.sendPresence(sid, body.to, body.presence);
  }
}
