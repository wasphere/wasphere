import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class UriDecodeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (
      exception instanceof URIError ||
      (exception instanceof Error && exception.message.startsWith('Failed to decode param'))
    ) {
      response.status(400).json({ error: 'INVALID_SESSION_ID' });
      return;
    }
    // Re-throw anything else — let other filters handle it
    throw exception;
  }
}
