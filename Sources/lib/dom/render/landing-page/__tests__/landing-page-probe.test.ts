/* eslint-env jest */

import { probeLandingPage } from "../landing-page-probe";

const PAGE_URL = "https://lp.batch.com/static/success";

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>): jest.Mock {
  const fetchMock = jest.fn(impl);
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("probeLandingPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("resolves true when the page answers ok", async () => {
    mockFetch(() => Promise.resolve({ ok: true }));
    await expect(probeLandingPage(PAGE_URL)).resolves.toBe(true);
  });

  test("resolves false on a non-ok status (a 404 is not recoverable after navigation)", async () => {
    mockFetch(() => Promise.resolve({ ok: false }));
    await expect(probeLandingPage(PAGE_URL)).resolves.toBe(false);
  });

  test("resolves false when the probe rejects (network or CORS failure)", async () => {
    mockFetch(() => Promise.reject(new Error("blocked")));
    await expect(probeLandingPage(PAGE_URL)).resolves.toBe(false);
  });

  test("resolves false when the probe hangs past the timeout", async () => {
    jest.useFakeTimers();
    mockFetch(() => new Promise(() => undefined));

    const probe = probeLandingPage(PAGE_URL, 3000);
    jest.advanceTimersByTime(3000);

    await expect(probe).resolves.toBe(false);
  });

  test("probes with HEAD, no cache, and no credentials", async () => {
    const fetchMock = mockFetch(() => Promise.resolve({ ok: true }));

    await probeLandingPage(PAGE_URL);

    expect(fetchMock).toHaveBeenCalledWith(
      PAGE_URL,
      expect.objectContaining({ method: "HEAD", cache: "no-store", credentials: "omit", redirect: "follow" })
    );
  });
});
