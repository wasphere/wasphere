import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

@Injectable()
export class ValidateSessionIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!SESSION_ID_REGEX.test(value)) {
      throw new BadRequestException({ error: 'INVALID_SESSION_ID' });
    }
    return value;
  }
}
