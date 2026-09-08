import { createAbortController } from "com.batch.dom/render/runtime/abort-controller";

const DEFAULT_PROBE_TIMEOUT_MS = 3000;

/** HEAD-probes the static error page before the caller navigates to it; an inconclusive probe resolves false. */
export function probeLandingPage(url: string, timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS): Promise<boolean> {
  const controller = createAbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
  });
  const probe = fetch(url, {
    method: "HEAD",
    cache: "no-store",
    credentials: "omit",
    redirect: "follow",
    signal: controller.fetchSignal,
  })
    .then(response => response.ok && !controller.signal.aborted)
    .catch(() => false);
  // No Promise.finally: it postdates the .browserslistrc floor (Chrome 54+).
  return Promise.race([probe, timeout]).then(result => {
    clearTimeout(timer);
    return result;
  });
}
