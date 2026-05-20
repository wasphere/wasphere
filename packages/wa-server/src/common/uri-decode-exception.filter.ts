import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class UriDecodeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Express URI decode errors come through as HttpException with "Failed to decode param" message
    const isUriDecodeError =
      exception instanceof URIError ||
      (exception instanceof HttpException &&
        exception.getStatus() === 400 &&
        typeof (exception.getResponse() as Record<string, unknown>)['message'] === 'string' &&
        ((exception.getResponse() as Record<string, unknown>)['message'] as string).startsWith(
          'Failed to decode param',
        ));

    if (isUriDecodeError) {
      response.status(400).json({ error: 'INVALID_SESSION_ID' });
      return;
    }

    // All other HttpExceptions — forward their own status and body unchanged
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // Unknown non-HTTP errors — 500
    response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
