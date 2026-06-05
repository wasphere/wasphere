export type MetaErrorCode =
  | 'OUTSIDE_24H_WINDOW' // free-form send outside the 24h customer-service window
  | 'META_AUTH_FAILED' // bad/expired access token or phone-number-id
  | 'UNSUPPORTED_MEDIA_SOURCE' // data: URI in link mode (upload mode is v1.3)
  | 'META_API_ERROR'; // any other Graph API failure

/**
 * A typed failure from the Meta Cloud API path (design §4). Carries a stable
 * `code` for callers to branch on, plus the raw Graph error for diagnostics.
 */
export class MetaApiError extends Error {
  readonly code: MetaErrorCode;
  readonly httpStatus?: number;
  readonly metaCode?: number;
  readonly metaSubcode?: number;

  constructor(
    code: MetaErrorCode,
    message: string,
    opts: { httpStatus?: number; metaCode?: number; metaSubcode?: number } = {},
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.code = code;
    this.httpStatus = opts.httpStatus;
    this.metaCode = opts.metaCode;
    this.metaSubcode = opts.metaSubcode;
  }
}
