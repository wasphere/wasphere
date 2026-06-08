import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { InboxService } from './inbox.service';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { PatchConversationDto } from './dto/patch-conversation.dto';
import { SendReplyDto } from './dto/send-reply.dto';
import { StartConversationDto } from './dto/start-conversation.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@ApiTags('Inbox')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/conversations')
@UseGuards(CombinedAuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations (cursor-paginated, filterable, searchable)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: '{ items: ConversationView[], nextCursor: string | null }' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  list(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.inbox.listConversations(req.user.userId, workspaceId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Start a new conversation by sending the first message to a number' })
  @ApiResponse({ status: 201, description: '{ conversationId }' })
  start(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: StartConversationDto,
  ) {
    return this.inbox.startConversation(req.user.userId, workspaceId, dto);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get one conversation with its contact' })
  @ApiResponse({ status: 200, description: 'ConversationView' })
  @ApiResponse({ status: 404, description: 'Conversation not found in this workspace' })
  get(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inbox.getConversation(req.user.userId, workspaceId, conversationId);
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'List messages in a conversation (newest-first, cursor-paginated)' })
  @ApiResponse({ status: 200, description: '{ items: Message[], nextCursor: string | null }' })
  messages(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.inbox.listMessages(req.user.userId, workspaceId, conversationId, query);
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: 'Update conversation status and/or tags' })
  @ApiResponse({ status: 200, description: 'Updated ConversationView' })
  patch(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: PatchConversationDto,
  ) {
    return this.inbox.patchConversation(req.user.userId, workspaceId, conversationId, dto);
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a conversation read (zero unreadCount)' })
  @ApiResponse({ status: 200, description: '{ ok: true, unreadCount: 0 }' })
  read(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inbox.markRead(req.user.userId, workspaceId, conversationId);
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a text reply (proxies to the WA Server)' })
  @ApiResponse({ status: 201, description: 'The created OUTBOUND message' })
  @ApiResponse({ status: 503, description: 'Session offline/deleted — reply not sent' })
  send(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendReplyDto,
  ) {
    return this.inbox.sendReply(req.user.userId, workspaceId, conversationId, dto);
  }
}
