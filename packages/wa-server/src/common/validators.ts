import { IsUrl } from 'class-validator';

// Type of options accepted by @IsUrl — extracted from the decorator's signature
type IsUrlOptions = Parameters<typeof IsUrl>[0];

export const URL_OPTIONS: IsUrlOptions = process.env.NODE_ENV === 'production'
  ? { require_tld: true, require_protocol: true }
  : { require_tld: false, require_protocol: true, host_whitelist: [/^localhost(:\d+)?$/, /^127\.0\.0\.1(:\d+)?$/] };
