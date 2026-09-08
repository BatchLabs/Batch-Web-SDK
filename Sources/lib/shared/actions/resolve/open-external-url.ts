import { asBoolean, asString } from "com.batch.shared/helpers/primitive";

export interface MessageOpenExternalURL {
  url: string | undefined;
  inPageDeeplinks: boolean;
}

export function resolveOpenExternalURL(
  args: Record<string, unknown> | undefined,
  fallbackMessageDeeplinks = false
): MessageOpenExternalURL {
  const url = asString(args?.["l"]);
  const inPageDeeplinks = asBoolean(args?.["li"], fallbackMessageDeeplinks);

  return { url, inPageDeeplinks };
}
