/* eslint-env jest */

jest.mock("com.batch.shared/helpers/uuid", () => {
  let minted = 0;
  return {
    __esModule: true,
    default: (): string => {
      minted += 1;
      return `00000000-0000-4000-8000-${String(minted).padStart(12, "0")}`;
    },
  };
});

import { WS_URL } from "../../../../config";
import { bootstrapLandingPage } from "../landing-page";

const INPUT_ENDPOINT = `${WS_URL}/lp/input/lp-42`;
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const PAYLOAD_JSON = `{"actions":{"bu3z":{"action":"batch.form.submit","params":{}}},"eventData":{"language":"default","project_key":"project_062ay7ywmgvqccwanj647mmqm1smq2kk","tid":"landing_6s17rvjnn26bdnf0t673d7scbn7m36za"},"format":"fullscreen","minMLvl":0,"position":"top","root":{"backgroundColor":["#FFFFFFFF","#FFFFFFFF"],"children":[{"id":"inku","type":"field","fieldType":"email","mapsTo":"$email_address","required":true,"labelTextId":"l€hc","placeholderId":"pak7","labelVisible":true,"margin":[8,0,8,0],"padding":[8,8,8,8],"width":100,"labelColor":["#000000FF","#000000FF"],"labelFontSize":14,"backgroundColor":["#FFFFFFFF","#FFFFFFFF"],"borderWidth":1,"borderColor":["#a3a3a3","#a3a3a3"],"radius":[8,8,8,8],"fontSize":14,"textColor":["#000000FF","#000000FF"],"marginDesktop":[16,0,16,0],"paddingDesktop":[8,8,8,8],"fontSizeDesktop":16,"labelFontSizeDesktop":16},{"id":"i0a1","type":"field","fieldType":"text","mapsTo":"first_name","required":true,"labelTextId":"lfl0","placeholderId":"pk6p","labelVisible":true,"margin":[8,0,8,0],"padding":[8,8,8,8],"width":100,"labelColor":["#000000FF","#000000FF"],"labelFontSize":14,"backgroundColor":["#FFFFFFFF","#FFFFFFFF"],"borderWidth":1,"borderColor":["#a3a3a3","#a3a3a3"],"radius":[8,8,8,8],"fontSize":14,"textColor":["#000000FF","#000000FF"],"marginDesktop":[16,0,16,0],"paddingDesktop":[8,8,8,8],"fontSizeDesktop":16,"labelFontSizeDesktop":16},{"id":"bu3z","type":"button","margin":[8,0,8,0],"padding":[8,8,8,8],"width":"100%","align":"center","backgroundColor":["#a3a3a3FF","#a3a3a3FF"],"radius":[8,8,8,8],"borderWidth":0,"borderColor":["#000000FF","#000000FF"],"textColor":["#FFFFFFFF","#FFFFFFFF"],"textAlign":"center","fontSize":14,"fontDecoration":[],"maxLines":0,"marginDesktop":[16,0,16,0],"paddingDesktop":[8,8,8,8],"fontSizeDesktop":16}],"margin":[8,8,8,8],"borderWidth":0,"marginDesktop":[16,16,16,16]},"texts":{"l€hc":"Email","pk6p":"Firstname","pak7":"Email","bu3z":"Submit","lfl0":"Firstname"},"trackingId":"","urls":{}}`;

const EMAIL_VALUE = "jean.dupont@example.com";
const FIRST_NAME_VALUE = "Jean";
const DECOY_VALUE = "bot-filled";

const GOLDEN_ANALYTICS_BODY =
  '{"session_id":"11111111-1111-4111-8111-111111111111","events":[{"id":"00000000-0000-4000-8000-000000000001","name":"_MESSAGING","date":"2026-09-01T10:00:00.000Z","params":{"ed":{"language":"default","project_key":"project_062ay7ywmgvqccwanj647mmqm1smq2kk","tid":"landing_6s17rvjnn26bdnf0t673d7scbn7m36za"},"type":"show"}},{"id":"00000000-0000-4000-8000-000000000002","name":"_MESSAGING","date":"2026-09-01T10:00:00.000Z","params":{"ed":{"language":"default","project_key":"project_062ay7ywmgvqccwanj647mmqm1smq2kk","tid":"landing_6s17rvjnn26bdnf0t673d7scbn7m36za"},"type":"cta_action","ctaId":"bu3z","ctaType":"button","action":"batch.form.submit","value":"{\\"$email\\":\\"jean.dupont@example.com\\",\\"first_name\\":\\"Jean\\"}"}}]}';

const GOLDEN_FORM_SUBMITTED_BODY =
  '{"session_id":"11111111-1111-4111-8111-111111111111","events":[{"id":"00000000-0000-4000-8000-000000000003","name":"_FORM_SUBMITTED","date":"2026-09-01T10:00:00.000Z","params":{"ed":{"language":"default","project_key":"project_062ay7ywmgvqccwanj647mmqm1smq2kk","tid":"landing_6s17rvjnn26bdnf0t673d7scbn7m36za"},"email":"jean.dupont@example.com","custom_attributes":{"first_name.s":"Jean"}}}]}';

const GOLDEN_BOT_FORM_SUBMITTED_BODY =
  '{"session_id":"11111111-1111-4111-8111-111111111111","events":[{"id":"00000000-0000-4000-8000-000000000006","name":"_FORM_SUBMITTED","date":"2026-09-01T10:00:00.000Z","params":{"ed":{"language":"default","project_key":"project_062ay7ywmgvqccwanj647mmqm1smq2kk","tid":"landing_6s17rvjnn26bdnf0t673d7scbn7m36za"},"honeypot":"bot-filled","email":"jean.dupont@example.com","custom_attributes":{"first_name.s":"Jean"}}}]}';

interface PostedRequest {
  url: string;
  init: RequestInit;
  body: string;
}

function postedRequests(fetchMock: jest.Mock): PostedRequest[] {
  return fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => ({ url, init, body: init.body as string }));
}

function requestFor(fetchMock: jest.Mock, name: string): PostedRequest {
  const matches = postedRequests(fetchMock).filter(request => {
    const parsed = JSON.parse(request.body) as { events: { name: string }[] };
    return parsed.events.every(event => event.name === name);
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe("landing page POST body", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date("2026-09-01T10:00:00.000Z"),
      doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
    sessionStorage.setItem("com.batch.lp.sessionId", SESSION_ID);
    (navigator as unknown as { sendBeacon?: unknown }).sendBeacon = undefined;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setupDom(): HTMLScriptElement {
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const marker = document.createElement("script");
    marker.type = "application/json";
    marker.id = "batch-lp-definition";
    marker.dataset.batchLp = "";
    marker.dataset.mount = "#batch-lp-root";
    marker.dataset.inputEndpoint = INPUT_ENDPOINT;
    marker.textContent = `{"payload":${PAYLOAD_JSON}}`;
    document.body.appendChild(marker);
    return marker;
  }

  function shadow(): ShadowRoot {
    const host = document.querySelector("#batch-lp-root .batch-lp-surface") as HTMLElement;
    return host.shadowRoot as ShadowRoot;
  }

  test("freezes the wire format of the events it posts", async () => {
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(init.body as string) as { events: { id: string }[] };
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: parsed.events.map(event => ({ id: event.id, status: "accepted" })) }),
      };
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await bootstrapLandingPage(setupDom());
    await flush();

    const inputs = shadow().querySelectorAll<HTMLInputElement>(".iam-input");
    expect(inputs).toHaveLength(2);
    inputs[0].value = EMAIL_VALUE;
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = FIRST_NAME_VALUE;
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));

    (shadow().querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    await flush();
    await flush();

    expect(postedRequests(fetchMock)).toHaveLength(2);
    const analytics = requestFor(fetchMock, "_MESSAGING");
    const submitted = requestFor(fetchMock, "_FORM_SUBMITTED");

    expect(analytics.body).toBe(GOLDEN_ANALYTICS_BODY);
    expect(submitted.body).toBe(GOLDEN_FORM_SUBMITTED_BODY);

    for (const request of [analytics, submitted]) {
      expect(request.url).toBe(INPUT_ENDPOINT);
      expect(request.init.method).toBe("POST");
      expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
      expect(request.init.credentials).toBe("omit");
    }
    // keepalive caps the body at 64 KiB, so the awaited submit must not use it.
    for (const request of [analytics, submitted]) {
      expect(request.init.redirect).toBe("error");
    }
    expect(analytics.init.keepalive).toBe(true);
    expect(submitted.init.keepalive).toBeUndefined();
  });

  test("freezes the wire format of a submit whose decoy came back filled", async () => {
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(init.body as string) as { events: { id: string }[] };
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: parsed.events.map(event => ({ id: event.id, status: "accepted" })) }),
      };
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await bootstrapLandingPage(setupDom());
    await flush();

    const inputs = shadow().querySelectorAll<HTMLInputElement>(".iam-input");
    inputs[0].value = EMAIL_VALUE;
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = FIRST_NAME_VALUE;
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    const decoy = shadow().querySelector<HTMLInputElement>("input.iam-decoy");
    if (!decoy) {
      throw new Error("the landing surface rendered no decoy field");
    }
    decoy.value = DECOY_VALUE;

    (shadow().querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    await flush();
    await flush();

    expect(requestFor(fetchMock, "_FORM_SUBMITTED").body).toBe(GOLDEN_BOT_FORM_SUBMITTED_BODY);
  });
});
