import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { SsrfBlockedError, SsrfTimeoutError } from './safe-fetch';

@Catch(SsrfBlockedError, SsrfTimeoutError)
export class SsrfExceptionFilter implements ExceptionFilter {
  catch(exception: SsrfBlockedError | SsrfTimeoutError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    if (exception instanceof SsrfBlockedError) {
      response.status(422).json({ error: 'SSRF_BLOCKED', detail: exception.reason });
    } else {
      response.status(504).json({ error: 'UPSTREAM_TIMEOUT' });
    }
  }
}
