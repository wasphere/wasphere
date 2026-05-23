import { IsUrl, registerDecorator, ValidationOptions } from 'class-validator';

// Type of options accepted by @IsUrl — extracted from the decorator's signature
type IsUrlOptions = Parameters<typeof IsUrl>[0];

export const URL_OPTIONS: IsUrlOptions = process.env.NODE_ENV === 'production'
  ? { require_tld: true, require_protocol: true }
  : { require_tld: false, require_protocol: true };

export function IsUrlOrDataUri(opts?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUrlOrDataUri',
      target: object.constructor,
      propertyName,
      options: opts,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !value) return false;
          if (value.startsWith('data:')) {
            return /^data:[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*;base64,[A-Za-z0-9+/]+=*$/.test(value);
          }
          try {
            const u = new URL(value);
            return u.protocol === 'http:' || u.protocol === 'https:';
          } catch { return false; }
        },
        defaultMessage: () => '$property must be a valid http/https URL or a base64 data URI',
      },
    });
  };
}
