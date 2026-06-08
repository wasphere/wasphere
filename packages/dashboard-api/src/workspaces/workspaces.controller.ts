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
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { ApiKeyPermissionGuard } from '../auth/api-key-permission.guard';
import { RequiresPermission } from '../auth/requires-permission.decorator';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/require-capability.decorator';
import { WorkspacesService } from './workspaces.service';
import { ProxyService } from './proxy.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { SetWaServerDto } from './dto/set-wa-server.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
    workspaceId?: string;
    permissions?: string[];
    sessionScope?: string | null;
  };
}

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
@UseGuards(CombinedAuthGuard, ApiKeyPermissionGuard, CapabilityGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly proxyService: ProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all workspaces the current user belongs to' })
  @ApiResponse({ status: 200, description: 'Array of workspace objects' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  list(@Req() req: AuthenticatedRequest) {
    return this.workspacesService.listForUser(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Created workspace' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(req.user.userId, dto);
  }

  @Get(':id')
  @RequiresPermission('workspace:read')
  @ApiOperation({ summary: 'Get a single workspace by ID' })
  @ApiParam({ name: 'id', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Workspace detail including waServerConfigured flag' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.getOne(req.user.userId, id);
  }

  @Patch(':id/wa-server')
  @RequiresPermission('workspace:write')
  @RequireCapability('settings')
  @ApiOperation({ summary: 'Configure the WA Server URL and API token for a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Updated workspace' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member or insufficient permissions' })
  setWaServer(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SetWaServerDto,
  ) {
    return this.workspacesService.setWaServer(req.user.userId, id, dto);
  }

  @Patch(':id/branding')
  @RequiresPermission('workspace:write')
  @RequireCapability('settings')
  @ApiOperation({ summary: 'Update dashboard branding (custom logo, name)' })
  @ApiParam({ name: 'id', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Branding updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Owner-only' })
  updateBranding(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.workspacesService.updateBranding(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequiresPermission('workspace:write')
  @RequireCapability('settings')
  @ApiOperation({ summary: 'Permanently delete a workspace and all its data' })
  @ApiParam({ name: 'id', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Workspace deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member or insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
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
  @ApiExcludeEndpoint()
  async proxyRequest(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') id: string,
    @Param('0') wildcardPath: string,
  ) {
    const apiKeyPermissions = req.user.permissions as
      | import('../lib/permissions').PermissionScope[]
      | undefined;
    await this.proxyService.proxy(
      req.user.userId,
      id,
      wildcardPath,
      req,
      res,
      apiKeyPermissions,
      req.user.sessionScope ?? null,
    );
  }
}
