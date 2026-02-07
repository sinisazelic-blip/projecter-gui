import { fail, asError } from "./response";

/**
 * Wraps Next.js route handlers (GET/POST/etc) and returns the same signature.
 * Works with (req) or (req, ctx) handlers.
 */
export function withApiErrorBoundary<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  opts?: { defaultCode?: string; defaultMessage?: string }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (e) {
      const code = opts?.defaultCode ?? "INTERNAL_ERROR";
      const msg = opts?.defaultMessage ?? "Neočekivana greška na serveru.";
      return fail(code, msg, 500, asError(e));
    }
  }) as T;
}
