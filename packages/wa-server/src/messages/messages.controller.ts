import { Controller, Post, Body, Param, Delete, Query, BadRequestException } from '@nestjs/common';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { MessagesService } from './messages.service';

class MarkReadDto {
  @IsString()
  to: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  messageIds: string[];
}

@Controller('sessions/:sessionId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('text')
  sendText(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; text: string; quotedId?: string },
  ) {
    return this.messagesService.sendText(sid, body.to, body.text, body.quotedId);
  }

  @Post('image')
  sendImage(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; caption?: string },
  ) {
    return this.messagesService.sendImage(sid, body.to, body.url, body.caption);
  }

  @Post('video')
  sendVideo(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; caption?: string },
  ) {
    return this.messagesService.sendVideo(sid, body.to, body.url, body.caption);
  }

  @Post('audio')
  sendAudio(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; isVoiceNote?: boolean },
  ) {
    return this.messagesService.sendAudio(sid, body.to, body.url, body.isVoiceNote);
  }

  @Post('document')
  sendDocument(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; fileName: string; mimetype: string },
  ) {
    return this.messagesService.sendDocument(sid, body.to, body.url, body.fileName, body.mimetype);
  }

  @Post('sticker')
  sendSticker(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string },
  ) {
    return this.messagesService.sendSticker(sid, body.to, body.url);
  }

  @Post('location')
  sendLocation(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; latitude: number; longitude: number; name?: string; address?: string },
  ) {
    return this.messagesService.sendLocation(sid, body.to, body.latitude, body.longitude, body.name, body.address);
  }

  @Post('contact')
  sendContact(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; displayName: string; phoneNumber: string },
  ) {
    return this.messagesService.sendContact(sid, body.to, body.displayName, body.phoneNumber);
  }

  @Post('buttons')
  sendButtons(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; text: string; footer: string; buttons: { id: string; text: string }[] },
  ) {
    return this.messagesService.sendButtons(sid, body.to, body.text, body.footer, body.buttons);
  }

  @Post('list')
  sendList(
    @Param('sessionId') sid: string,
    @Body() body: {
      to: string;
      title: string;
      text: string;
      buttonText: string;
      sections: { title: string; rows: { id: string; title: string; description?: string }[] }[];
    },
  ) {
    return this.messagesService.sendList(sid, body.to, body.title, body.text, body.buttonText, body.sections);
  }

  @Post('poll')
  sendPoll(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; name: string; options: string[]; selectableCount?: number },
  ) {
    return this.messagesService.sendPoll(sid, body.to, body.name, body.options, body.selectableCount);
  }

  @Post('reaction')
  sendReaction(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; messageId: string; emoji: string },
  ) {
    return this.messagesService.sendReaction(sid, body.to, body.messageId, body.emoji);
  }

  @Post('gif')
  sendGif(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; caption?: string },
  ) {
    return this.messagesService.sendGif(sid, body.to, body.url, body.caption);
  }

  @Post('view-once')
  sendViewOnce(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; url: string; caption?: string },
  ) {
    return this.messagesService.sendViewOnce(sid, body.to, body.url, body.caption);
  }

  @Post(':messageId/edit')
  editMessage(
    @Param('sessionId') sid: string,
    @Param('messageId') messageId: string,
    @Body() body: { to: string; text: string },
  ) {
    return this.messagesService.editMessage(sid, body.to, messageId, body.text);
  }

  @Delete(':messageId')
  deleteMessage(
    @Param('sessionId') sid: string,
    @Param('messageId') messageId: string,
    @Query('to') to: string,
    @Query('forEveryone') forEveryoneStr: string,
  ) {
    if (!to) throw new BadRequestException('to query parameter is required');
    const forEveryone = forEveryoneStr !== 'false';
    return this.messagesService.deleteMessage(sid, to, messageId, forEveryone);
  }

  @Post('read')
  markRead(
    @Param('sessionId') sid: string,
    @Body() body: MarkReadDto,
  ) {
    return this.messagesService.markRead(sid, body.to, body.messageIds);
  }

  @Post('typing')
  sendTyping(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; isGroup?: boolean },
  ) {
    return this.messagesService.sendTyping(sid, body.to, body.isGroup);
  }

  @Post('presence')
  sendPresence(
    @Param('sessionId') sid: string,
    @Body() body: { to: string; presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused' },
  ) {
    return this.messagesService.sendPresence(sid, body.to, body.presence);
  }
}
