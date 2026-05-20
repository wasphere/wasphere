import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { CreateSessionDto } from './dto/create-session.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  // GET /api/sessions — list all sessions
  @Get()
  getAll() {
    return this.sessionsService.getAllSessions();
  }

  // GET /api/sessions/:id — get single session info + QR if pending
  @Get(':id')
  getOne(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.getSessionInfo(id);
  }

  // POST /api/sessions — create new session (starts QR process)
  @Post()
  create(@Body() body: CreateSessionDto) {
    return this.sessionsService.createSession(body.id);
  }

  // DELETE /api/sessions/:id — disconnect & remove session
  @Delete(':id')
  delete(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.deleteSession(id);
  }

  // POST /api/sessions/:id/logout — logout from WhatsApp (user stays in system)
  @Post(':id/logout')
  logout(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.logoutSession(id);
  }
}
