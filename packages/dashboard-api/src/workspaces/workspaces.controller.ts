import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { ProxyService } from './proxy.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { SetWaServerDto } from './dto/set-wa-server.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly proxyService: ProxyService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.workspacesService.listForUser(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(req.user.userId, dto);
  }

  @Get(':id')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.getOne(req.user.userId, id);
  }

  @Patch(':id/wa-server')
  setWaServer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SetWaServerDto,
  ) {
    return this.workspacesService.setWaServer(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteWorkspace(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.deleteWorkspace(req.user.userId, id);
  }

  @All(':id/proxy/*')
  async proxyRequest(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') id: string,
    @Param('0') wildcardPath: string,
  ) {
    await this.proxyService.proxy(req.user.userId, id, wildcardPath, req, res);
  }
}
