/**
 * The mutation runner rewrites the `testEnvironment` of `jest.config.js`, never a docblock: a file that scopes its own
 * environment must name Stryker's mixin itself, or the run reports no coverage for it. It is a plain node env otherwise.
 *
 * @jest-environment @stryker-mutator/jest-runner/jest-env/node
 */
/* eslint-env jest */

import { WS_URL } from "../../../../../config";
import { resolveInputEndpoint } from "../input-contract";

describe("resolveInputEndpoint without a document", () => {
  it("cannot resolve a relative endpoint: there is no page to resolve it against", () => {
    expect(resolveInputEndpoint("/lp/input/lp-42")).toBeNull();
  });

  it("accepts the Batch backend by origin alone", () => {
    expect(resolveInputEndpoint(`${WS_URL}/lp/input/lp-42`)).toBe(`${WS_URL}/lp/input/lp-42`);
  });
});
