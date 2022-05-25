import { Log, LogLevel } from "../logger";
import ParameterStore from "../parameters/parameter-store";
import { IWebservice } from "./base";
import HttpError from "./http-error";

const logModuleName = "WSExecutor";

/**
 * The IWebserviceExecutor is used to execute webservices.
 * It requires the sender to correctly setup a specialized BaseWebservice subclass.
 * The executor will then make the full request out of it, and execute it.
 */
export interface IWebserviceExecutor {
  /**
   * "Starts" a webservice: make a request out of it and send it to the backend.
   * The backend's raw answer will be returned on success.
   */
  start(ws: IWebservice): Promise<unknown>;
}

export default class WebserviceExecutor implements IWebserviceExecutor {
  private apiKey: string;
  private authKey?: string;
  private devMode: boolean;
  private referrer?: string;
  private parameterStore: ParameterStore;

  public constructor(
    apiKey: string,
    authKey: string | undefined,
    devMode: boolean,
    referrer: string | undefined,
    parameterStore: ParameterStore
  ) {
    this.apiKey = apiKey;
    this.authKey = authKey;
    this.devMode = devMode;
    this.referrer = referrer;
    this.parameterStore = parameterStore;
  }

  public async start(ws: IWebservice): Promise<unknown> {
    if (typeof fetch === "undefined") {
      return Promise.reject(new Error("fetch API isn't available"));
    }

    const options: RequestInit = {
      body: "",
      cache: "no-cache",
      credentials: "omit",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      method: "POST",
      mode: "cors",
    };

    if (!this.devMode && typeof this.authKey === "string") {
      (options.headers as Headers).set("X-Batch-Auth", this.authKey);
    }

    if (this.devMode) {
      (options.headers as Headers).set("X-Batch-Dev", "true");
    }

    if (this.referrer) {
      (options.headers as Headers).set("X-Batch-Referer", this.referrer);
    }

    try {
      const body = await ws.getBody(this.parameterStore);
      options.body = JSON.stringify(body);

      const URL = ws.getBaseURL() + "/" + this.apiKey;

      Log.grouped(LogLevel.Info, logModuleName, "Calling WS", [`URL: ${URL}`, body, options]);

      const response = await fetch(URL, options);
      if (!response.ok) {
        throw new HttpError(response);
      }
      Log.grouped(LogLevel.Info, logModuleName, "WS finished successfuly", [`Status text: ${response.statusText}`]);

      return response.json();
    } catch (error) {
      Log.error(logModuleName, "Error while executing WS", error);
      throw error;
    }
  }
}
