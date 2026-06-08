import {
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/require-capability.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/api-keys')
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireCapability('api_keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List all API keys for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Array of API key metadata (no secrets)' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  list(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    return this.apiKeysService.list(req.user.userId, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an API key',
    description: 'Returns the raw key exactly once. Store it securely — it cannot be retrieved again.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 201, description: 'Created key including raw value (shown once)' })
  @ApiResponse({ status: 400, description: 'Invalid permissions' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(req.user.userId, workspaceId, dto);
  }

  @Patch(':keyId')
  @ApiOperation({ summary: 'Update an API key (name, permissions, active status, expiry)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'keyId', description: 'API key UUID' })
  @ApiResponse({ status: 200, description: 'Updated key metadata' })
  @ApiResponse({ status: 400, description: 'Invalid permissions' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('keyId') keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(req.user.userId, workspaceId, keyId, dto);
  }

  @Post(':keyId/rotate')
  @ApiOperation({
    summary: 'Rotate an API key',
    description:
      'Generates a new secret for the key. The old key is immediately invalidated. Returns the new raw key once.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'keyId', description: 'API key UUID' })
  @ApiResponse({ status: 200, description: 'New raw key (shown once)' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  rotate(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.rotate(req.user.userId, workspaceId, keyId);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an API key' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'keyId', description: 'API key UUID' })
  @ApiResponse({ status: 200, description: 'Deletion confirmed' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.remove(req.user.userId, workspaceId, keyId);
  }
}
