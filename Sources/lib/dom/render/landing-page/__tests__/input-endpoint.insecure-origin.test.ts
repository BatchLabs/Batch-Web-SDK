/**
 * The mutation runner rewrites the `testEnvironment` of `jest.config.js`, never a docblock: a file that scopes its own
 * environment must name Stryker's mixin itself, or the run reports no coverage for it. It is a plain jsdom otherwise.
 *
 * @jest-environment @stryker-mutator/jest-runner/jest-env/jsdom
 * @jest-environment-options {"url": "http://shop.example/landing"}
 */
/* eslint-env jest */

import { WS_URL } from "../../../../../config";
import { resolveInputEndpoint } from "../input-contract";

describe("resolveInputEndpoint on a plain-http page", () => {
  it("refuses the page's own origin when it is not https", () => {
    expect(resolveInputEndpoint("/lp/input/lp-42")).toBeNull();
    expect(resolveInputEndpoint("http://shop.example/lp/input/lp-42")).toBeNull();
  });

  it("still accepts the Batch backend", () => {
    expect(resolveInputEndpoint(`${WS_URL}/lp/input/lp-42`)).toBe(`${WS_URL}/lp/input/lp-42`);
  });
});
