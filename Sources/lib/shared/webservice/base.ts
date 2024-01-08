import { fillDefaultDataCollectionConfiguration, serializeDataCollectionConfig } from "com.batch.shared/data-collection";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";

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
  public async getHeaders(parameterStore: IParameterStore): Promise<object> {
    // Add default header keys
    const parameters = await parameterStore.getParametersValues(DefaultHeaderKeys);
    const probationManager = new ProbationManager(parameterStore as ParameterStore);
    Object.keys(parameters).forEach(key => {
      const value = parameters[key];
      if (value != null) {
        parameters[key] = "" + value;
      }
    });

    // Add data collection
    const lastConfig = (await parameterStore.getParameterValue(ProfileKeys.LastConfiguration)) as IPrivateBatchSDKConfiguration | null;
    const dataCollection = fillDefaultDataCollectionConfiguration(lastConfig?.defaultDataCollection);
    parameters["data_collection"] = serializeDataCollectionConfig(dataCollection);

    // Add profile probation
    parameters["profile_probation"] = await probationManager.isInProfileProbation();
    return parameters;
  }

  // Returns the full webservice request body (query + headers) as an object
  public async getBody(parameterStore: IParameterStore): Promise<object> {
    const headers = await this.getHeaders(parameterStore);
    return {
      ...this.getQuery(),
      ids: headers,
    };
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
