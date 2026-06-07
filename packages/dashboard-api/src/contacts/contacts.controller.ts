import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { ContactsService } from './contacts.service';

class ListContactsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}

class RenameContactDto {
  @IsOptional() @IsString() @MaxLength(100) savedName?: string;
}

interface AuthedRequest extends Request {
  user: { userId: string };
}

@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/contacts')
@UseGuards(CombinedAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List/search contacts (the contact book)' })
  list(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Query() q: ListContactsQueryDto,
  ) {
    return this.contacts.list(req.user.userId, workspaceId, q);
  }

  @Patch(':contactId')
  @ApiOperation({ summary: 'Rename a contact (operator-set saved name)' })
  rename(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
    @Body() dto: RenameContactDto,
  ) {
    return this.contacts.rename(req.user.userId, workspaceId, contactId, dto.savedName ?? null);
  }
}
