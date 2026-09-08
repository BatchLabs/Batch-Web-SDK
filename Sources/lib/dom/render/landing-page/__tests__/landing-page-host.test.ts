/* eslint-env jest */

import { LandingPageAnalyticsSink } from "com.batch.dom/render/landing-page/landing-page-analytics-sink";
import { createLandingPageHost } from "com.batch.dom/render/landing-page/landing-page-host";
import { InlineLandingSurfaceStrategy } from "com.batch.dom/render/runtime/surface/inline-landing-surface-strategy";

const CONFIG = {
  mountSelector: "#custom-mount",
  showEmbeddedErrorPage: jest.fn(),
};

describe("createLandingPageHost", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("wires the landing host with a non-dismissable inline surface", () => {
    const host = createLandingPageHost(CONFIG);

    expect(host.surface.dismissable).toBe(false);
    expect(host.analyticsSink).toBeInstanceOf(LandingPageAnalyticsSink);
    expect(host.surface).toBeInstanceOf(InlineLandingSurfaceStrategy);
    // The 960px content cap is a rule of this host, set by the PRD.
    expect(host.surface.contentLayout).toEqual({ maxWidth: 960 });

    for (const allowed of ["batch.deeplink", "batch.clipboard", "batch.group", "batch.form.submit"]) {
      expect(host.actions.hasAction(allowed)).toBe(true);
    }
    for (const notRegistered of [
      "deeplink",
      "openurl",
      "batch.user.event",
      "batch.user.tag",
      "batch.request_notifications",
      "batch.dismiss",
    ]) {
      expect(host.actions.hasAction(notRegistered)).toBe(false);
    }
  });

  test("propagates the mount selector to the surface", () => {
    const mount = document.createElement("div");
    mount.id = "custom-mount";
    document.body.appendChild(mount);

    const host = createLandingPageHost(CONFIG);
    const rendered = document.createElement("main");
    host.surface.attach(rendered);

    expect(mount.contains(rendered)).toBe(true);
  });
});
