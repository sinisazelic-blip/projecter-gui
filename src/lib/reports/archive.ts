import { isEnterInstance } from "@/lib/fluxa-instance";

/** Studio TAF 20-godišnja staging arhiva. Enter kreće od nule — nikad. */
export function includeStudioArchive(): boolean {
  return !isEnterInstance();
}
