import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { MetaApiError } from '../whatsapp/providers/meta-api-error';
import { CapabilityError } from '../whatsapp/providers/capability-error';

/**
 * Surfaces provider failures as meaningful HTTP responses instead of an opaque
 * 500. Without this, a Meta Graph error (bad token, outside the 24h window,
 * recipient not allowed, link-mode media) reached the client as a bare
 * "Internal server error" with no reason.
 */
@Catch(MetaApiError, CapabilityError)
export class ProviderExceptionFilter implements ExceptionFilter {
  catch(exception: MetaApiError | CapabilityError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof CapabilityError) {
      res.status(501).json({
        error: 'CAPABILITY_NOT_SUPPORTED',
        message: exception.message,
        capability: exception.capability,
        provider: exception.provider,
      });
      return;
    }

    // MetaApiError → map the typed code to a sensible HTTP status.
    const status = httpStatusFor(exception);
    res.status(status).json({
      error: exception.code,
      message: exception.message,
      provider: 'meta',
      metaCode: exception.metaCode,
      metaSubcode: exception.metaSubcode,
    });
  }
}

function httpStatusFor(err: MetaApiError): number {
  switch (err.code) {
    case 'META_AUTH_FAILED':
      return 401;
    case 'OUTSIDE_24H_WINDOW':
      return 422; // actionable: send an approved template instead
    case 'UNSUPPORTED_MEDIA_SOURCE':
      return 400; // link-mode needs a public URL (upload mode is v1.3)
    case 'META_API_ERROR':
    default:
      // Pass through a 4xx Graph status (e.g. recipient not allowed); else 502.
      return err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 500
        ? err.httpStatus
        : 502;
  }
}
