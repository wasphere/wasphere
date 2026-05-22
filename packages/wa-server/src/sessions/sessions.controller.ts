import { Controller, Get, Post, Delete, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { ValidateSessionIdPipe } from '../common/validate-session-id.pipe';
import { CreateSessionDto } from './dto/create-session.dto';
import { PatchSessionConfigDto } from './dto/patch-session-config.dto';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  // GET /api/sessions — list all sessions
  @Get()
  @ApiOperation({
    summary: 'List all sessions',
    description: 'Returns an array of all registered WhatsApp sessions and their current status (connected, pending QR, disconnected).',
  })
  @ApiResponse({ status: 200, description: 'Array of session objects.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  getAll() {
    return this.sessionsService.getAllSessions();
  }

  // GET /api/sessions/:id — get single session info + QR if pending
  @Get(':id')
  @ApiOperation({
    summary: 'Get session info',
    description: 'Returns the status and details for a single session. If the session is awaiting QR scan, the response includes a base64-encoded QR code image.',
  })
  @ApiParam({ name: 'id', description: 'Session identifier (alphanumeric, hyphens, underscores only)', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Session info object.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  getOne(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.getSessionInfo(id);
  }

  // POST /api/sessions — create new session (starts QR process)
  @Post()
  @ApiOperation({
    summary: 'Create a new session',
    description: 'Registers a new WhatsApp session and starts the QR code authentication flow. Poll GET /sessions/:id to retrieve the QR code once generated.',
  })
  @ApiResponse({ status: 201, description: 'Session created. QR code generation started.' })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 422, description: 'Session with this ID already exists.' })
  create(@Body() body: CreateSessionDto) {
    const { id, proxy, random_delay_min_ms, random_delay_max_ms, auto_read_on_receive, receive_enabled } = body;
    const config: Record<string, any> = {};
    if (random_delay_min_ms !== undefined) config['random_delay_min_ms'] = random_delay_min_ms;
    if (random_delay_max_ms !== undefined) config['random_delay_max_ms'] = random_delay_max_ms;
    if (auto_read_on_receive !== undefined) config['auto_read_on_receive'] = auto_read_on_receive;
    if (receive_enabled !== undefined) config['receive_enabled'] = receive_enabled;
    return this.sessionsService.createSession(id, proxy, Object.keys(config).length > 0 ? config : undefined);
  }

  // DELETE /api/sessions/:id — disconnect & remove session
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a session',
    description: '⚠️ DESTRUCTIVE: Permanently removes the session, disconnects the WhatsApp socket, and deletes all stored session credentials from disk. This cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Session deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  delete(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.deleteSession(id);
  }

  // PATCH /api/sessions/:id/config — hot-update per-session config
  @Patch(':id/config')
  @ApiOperation({ summary: 'Update per-session config (hot-applied, no restart)' })
  @ApiParam({ name: 'id', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Merged config after save.' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. max < min).' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  patchConfig(
    @Param('id', ValidateSessionIdPipe) id: string,
    @Body() body: PatchSessionConfigDto,
  ) {
    return this.sessionsService.patchSessionConfig(id, body);
  }

  // POST /api/sessions/:id/logout — logout from WhatsApp (user stays in system)
  @Post(':id/logout')
  @ApiOperation({
    summary: 'Logout a session from WhatsApp',
    description: '⚠️ DESTRUCTIVE: Sends a logout signal to WhatsApp and clears the session credentials. The session record remains registered in the server but must re-authenticate via QR before use.',
  })
  @ApiParam({ name: 'id', description: 'Session identifier', example: 'my-session' })
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  @ApiResponse({ status: 500, description: 'Baileys adapter error. Body contains { error: string }.' })
  logout(@Param('id', ValidateSessionIdPipe) id: string) {
    return this.sessionsService.logoutSession(id);
  }
}
