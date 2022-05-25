import { SDK_VERSION, WS_URL } from "../../../config";
import { ProfileKeys } from "../parameters/keys.profile";
import { SystemKeys } from "../parameters/keys.system";
import { IParameterStore } from "../parameters/parameters";

const DefaultHeaderKeys: string[] = [
  ProfileKeys.CustomIdentifier,
  ProfileKeys.UserRegion,
  ProfileKeys.UserLanguage,
  ProfileKeys.UserProfileVersion,
  ProfileKeys.InstallationID,
  SystemKeys.SDKAPILevel,
  SystemKeys.DeviceTimezone,
  SystemKeys.DeviceTimezoneOffset,
  SystemKeys.DeviceDate,
  SystemKeys.DeviceLanguage,
];

const BaseURL = `${WS_URL}/${SDK_VERSION}/`;

/**
 * IWebservice represents a webservice class.
 * A WS has a shortname (for the URL), and a query body.
 * Any WS should extend BaseWebservice: this interface is described for IWebserviceExecutor
 */
export interface IWebservice {
  getHeaders(parameterStore: IParameterStore): Promise<object>;
  getBody(parameterProvider: IParameterStore): Promise<object>;
  getBaseURL(): string;
  getURLShortname(): string;
  getQuery(): object;
}

// BaseWebservice is the base class for all webservices.
// They should extend it and override getQuery() and getURLShortname().
// The webservice executor is the one that will then send it rather than the WS itself.
export default class BaseWebservice implements IWebservice {
  public getHeaders(parameterStore: IParameterStore): Promise<object> {
    return parameterStore.getParametersValues(DefaultHeaderKeys).then(parameters => {
      Object.keys(parameters).forEach(key => {
        const value = parameters[key];
        if (value != null) {
          parameters[key] = "" + value;
        }
      });
      return parameters;
    });
  }

  // Returns the full webservice request body (query + headers) as an object
  public getBody(parameterStore: IParameterStore): Promise<object> {
    return this.getHeaders(parameterStore).then(h => {
      return {
        ...this.getQuery(),
        ids: h,
      };
    });
  }

  public getBaseURL(): string {
    return BaseURL + this.getURLShortname();
  }

  public getQuery(): object {
    throw new Error("BaseWebservice subclasses should override getQuery()");
  }

  public getURLShortname(): string {
    throw new Error("BaseWebservice subclasses should override getURLShortname()");
  }
}
