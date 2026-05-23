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
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { ApiKeyPermissionGuard } from '../auth/api-key-permission.guard';
import { RequiresPermission } from '../auth/requires-permission.decorator';
import { WorkspacesService } from './workspaces.service';
import { ProxyService } from './proxy.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { SetWaServerDto } from './dto/set-wa-server.dto';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string; workspaceId?: string; permissions?: string[] };
}

@ApiTags('Workspaces')
@Controller('workspaces')
@UseGuards(CombinedAuthGuard, ApiKeyPermissionGuard)
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
  @RequiresPermission('workspace:read')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.getOne(req.user.userId, id);
  }

  @Patch(':id/wa-server')
  @RequiresPermission('workspace:write')
  setWaServer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SetWaServerDto,
  ) {
    return this.workspacesService.setWaServer(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequiresPermission('workspace:write')
  deleteWorkspace(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.deleteWorkspace(req.user.userId, id);
  }

  @Get(':id/stats')
  @RequiresPermission('workspace:read')
  @ApiTags('workspaces')
  @ApiOperation({ summary: 'Message statistics for a workspace (last 7 days + totals)' })
  @ApiResponse({ status: 200, description: 'Stats object' })
  getStats(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.getStats(id, req.user.userId);
  }

  @Get(':id/audit-logs')
  @RequiresPermission('audit:read')
  @ApiTags('workspaces')
  @ApiOperation({ summary: 'List audit logs for a workspace' })
  @ApiResponse({ status: 200, description: 'Paginated audit log list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiQuery({ name: 'page',       required: false, type: Number })
  @ApiQuery({ name: 'pageSize',   required: false, type: Number })
  @ApiQuery({ name: 'from',       required: false, type: String })
  @ApiQuery({ name: 'to',         required: false, type: String })
  @ApiQuery({ name: 'sessionId',  required: false, type: String })
  @ApiQuery({ name: 'statusCode', required: false, type: Number })
  getAuditLogs(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: GetAuditLogsQueryDto,
  ) {
    return this.workspacesService.getAuditLogs(id, req.user.userId, query);
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
