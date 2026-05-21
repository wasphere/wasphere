import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export function PatternPipe(regex: RegExp, maxLength: number, errorCode = 'INVALID_PARAM') {
  @Injectable()
  class Pipe implements PipeTransform<string, string> {
    transform(value: string): string {
      if (!value || value.length > maxLength || !regex.test(value)) {
        throw new BadRequestException({ error: errorCode });
      }
      return value;
    }
  }
  return Pipe;
}

export const ValidatePhoneNumberPipe = PatternPipe(/^[\d+@\w.]{1,40}$/, 40, 'INVALID_PHONE_NUMBER');
export const ValidateMessageIdPipe   = PatternPipe(/^[a-zA-Z0-9_-]{1,100}$/, 100, 'INVALID_MESSAGE_ID');
export const ValidateGroupIdPipe     = PatternPipe(/^[\d+@\w.]{1,40}$/, 40, 'INVALID_GROUP_ID');
