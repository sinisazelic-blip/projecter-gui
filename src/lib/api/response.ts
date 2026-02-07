import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; code: string; message: string; details?: unknown };

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data } satisfies ApiOk<T>, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  const body: ApiErr = { ok: false, code, message, ...(details !== undefined ? { details } : {}) };
  return NextResponse.json(body, { status });
}

export function asError(e: unknown) {
  if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack };
  return { message: String(e) };
}
