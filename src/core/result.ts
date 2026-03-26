import type { Result } from "../types";

export const ok = <T>(value: T): Result<T> => [value, true] as const;
export const err = <T>(): Result<T> => [null, false] as const;
