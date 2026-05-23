import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalSecretGuard } from './internal-secret.guard';
import { InternalService } from './internal.service';
import { AuditEventDto } from './dto/audit-event.dto';

@ApiTags('Internal')
@Controller('internal')
@UseGuards(InternalSecretGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('audit')
  @HttpCode(HttpStatus.CREATED)
  async audit(@Body() dto: AuditEventDto) {
    await this.internalService.ingestAudit(dto);
    return { success: true };
  }
}
