/** Request-level failures. Per-message problems are results, not errors. */
export class IngestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'IngestError';
  }
}

export const badRequest = (code: string, message: string) => new IngestError(400, code, message);
export const unauthorised = (message: string) => new IngestError(401, 'unauthorized', message);
export const tooLarge = (message: string) => new IngestError(413, 'payload_too_large', message);
export const rateLimited = (retryAfterSeconds: number) =>
  new IngestError(429, 'rate_limited', 'Too many requests. Please slow down.', {
    'retry-after': String(Math.max(1, Math.ceil(retryAfterSeconds))),
  });
