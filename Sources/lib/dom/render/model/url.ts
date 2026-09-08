import { RENDER_LOG_MODULE } from "com.batch.dom/render/render-constants";
import { isSafeURL } from "com.batch.shared/helpers/url";
import { Log } from "com.batch.shared/logger";

export function filterSafeURLEntries(urls: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(urls)) {
    if (isSafeURL(urls[key])) {
      result[key] = urls[key];
    } else {
      Log.warn(RENDER_LOG_MODULE, `[normalizer] URL blocked for key "${key}" (unsafe scheme): ${urls[key]}`);
    }
  }
  return result;
}
