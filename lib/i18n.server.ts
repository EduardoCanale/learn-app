import { cookies } from "next/headers";
import { LOCALE_COOKIE, dict, toLocale, type Locale, type Strings } from "./i18n";

/** Server-only half of i18n: `next/headers` cannot be imported from a client component. */
export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getStrings(): Promise<Strings> {
  return dict[await getLocale()];
}
