import Event from "com.batch.shared/event/event";
import { InternalSDKEvent } from "com.batch.shared/event/event-names";
import EventTracker from "com.batch.shared/event/event-tracker";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { isNumber, isString, isUnknownObject } from "com.batch.shared/helpers/primitive";
import { TaskQueue } from "com.batch.shared/helpers/task-queue";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { ProbationManager, ProbationType } from "com.batch.shared/managers/probation-manager";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import { indexedDBKeyBinder } from "com.batch.shared/parameters/keys.profile";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IProfileOperation } from "com.batch.shared/profile/profile-attribute-editor";
import { hasProfileDataChanged } from "com.batch.shared/profile/profile-data-diff";
import {
  ProfileAttributeType,
  ProfileCustomDataAttributes,
  ProfileNativeAttributeType,
  ProfileNativeDataAttribute,
} from "com.batch.shared/profile/profile-data-types";
import ProfileDataWriter from "com.batch.shared/profile/profile-data-writer";
import {
  convertProfileDataAttributesToUserAttributes,
  convertProfileDataAttributesToUserPublicTags,
  convertProfileDataAttributesToUserTags,
} from "com.batch.shared/profile/user-compat-helper";
import { BatchUserAttribute } from "com.batch.shared/profile/user-data-public";
import { UserDataStorage } from "com.batch.shared/profile/user-data-storage";
import { UserAttributeType } from "com.batch.shared/profile/user-data-types";
import { AttributesCheckService } from "com.batch.shared/webservice/attributes-check";
import { AttributesSendService } from "com.batch.shared/webservice/attributes-send";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";
import { isAttributesCheckResponse } from "com.batch.shared/webservice/responses/attributes-check-response";

import { BatchSDK } from "../../../public/types/public-api";

const logModuleName = "User";

const MIN_ATTRIBUTES_CHECK_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes

/**
 * This class is mainly the old user-module.
 * Its now use to handle the compatibility with the install-based model.
 */
export class UserCompatModule {
  private probationManager;
  private dataStorage;
  private webserviceExecutor;
  private taskQueue; // Task queue, ensuring that we handle persistence in a sequential way
  private eventTracker: EventTracker;

  public constructor(
    probationManager: ProbationManager,
    webserviceExecutor: IWebserviceExecutor,
    dataStorage: UserDataStorage,
    eventTracker: EventTracker
  ) {
    this.probationManager = probationManager;
    this.dataStorage = dataStorage;
    this.webserviceExecutor = webserviceExecutor;
    this.eventTracker = eventTracker;
    this.taskQueue = new TaskQueue();
    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onExitedProbation.bind(this));
    LocalEventBus.subscribe(LocalSDKEvent.SessionStarted, this.onSessionStarted.bind(this));
  }
  private onExitedProbation(param: { type: ProbationType }): void {
    if (param.type === ProbationType.Push) {
      Log.debug(logModuleName, "User is out of probation, sending data.");
      this.scheduleAttributesSend();
    }
  }

  private onSessionStarted(): void {
    this.scheduleAttributesCheck();
  }

  public async notifyInstallDataChanged(customId?: string | null): Promise<void> {
    await this.bumpProfileVersion();
    this.eventTracker.track(new Event(InternalSDKEvent.InstallNativeDataChanged));
    if (customId !== undefined) {
      LocalEventBus.emit(LocalSDKEvent.NativeDataChanged, { [keysByProvider.profile.CustomIdentifier]: customId }, true);
    }
  }

  // Returns the public-api version of the attributes
  public async getPublicAttributes(): Promise<{ [key: string]: BatchSDK.IUserAttribute }> {
    const profileAttributes = await this.dataStorage.getAttributes();
    const privateAttributes = convertProfileDataAttributesToUserAttributes(profileAttributes);
    const publicAttributes: { [key: string]: BatchSDK.IUserAttribute } = {};

    for (const [key, typedValue] of Object.entries(privateAttributes)) {
      const type = typedValue.type;
      let value: unknown = typedValue.value;

      if (type === UserAttributeType.DATE) {
        // We can cast, storage is supposed to make sure that the value are coherent
        value = new Date(value as number);
      }

      publicAttributes[key] = new BatchUserAttribute(type, value);
    }

    return publicAttributes;
  }

  // Returns the public-api version of the tags
  public async getPublicTagCollections(): Promise<{ [key: string]: string[] }> {
    const profileAttributes = await this.dataStorage.getAttributes();
    return convertProfileDataAttributesToUserPublicTags(profileAttributes);
  }

  /**
   * Clear the installation data.
   */
  public async clearInstallationData(): Promise<void> {
    const oldCustomAttributes = await this.dataStorage.getAttributes();
    const newCustomAttributes = {};
    await this.persistAndSendCustomAttributesIfNeeded(oldCustomAttributes, newCustomAttributes);
  }

  /** Start the user compat process.
   *
   * 1: Get old data
   * 2: Get new data (data writer)
   * 3: Check diff
   * 4: Persist new ones
   * 5: Check Probation
   * 6: Bump and Persist version
   * 7: Schedule Send
   */
  public async applyInstallOperations(operations: IProfileOperation[]): Promise<void> {
    // Get old custom attributes saved locally
    const oldCustomAttributes = await this.dataStorage.getAttributes();
    const dataWriter = new ProfileDataWriter(true, oldCustomAttributes);

    // Check if native data has changed
    const nativeAttributes = await dataWriter.applyNativeOperations(operations);
    const nativeAttributesChanged = await this.persistNativeAttributes(nativeAttributes);
    if (nativeAttributesChanged) {
      await this.notifyInstallDataChanged();
    }

    try {
      // Get new custom attributes
      const newCustomAttributes = await dataWriter.applyCustomOperations(operations);

      // Try to save and send
      await this.persistAndSendCustomAttributesIfNeeded(oldCustomAttributes, newCustomAttributes);
    } catch (e) {
      Log.warn(logModuleName, e);
    }
  }

  /**
   * Save and send custom attributes if user is not in probation and data has changed
   * @param oldCustomAttributes Old persisted data
   * @param newCustomAttributes New applied data
   * @private
   */
  private async persistAndSendCustomAttributesIfNeeded(
    oldCustomAttributes: ProfileCustomDataAttributes,
    newCustomAttributes: ProfileCustomDataAttributes
  ): Promise<void> {
    const customAttributesChanged = hasProfileDataChanged(oldCustomAttributes, newCustomAttributes);
    if (!customAttributesChanged) {
      Log.debug(logModuleName, "Compat: User saved data but no changes were detected.");
      return;
    }

    // Save custom data
    await this.persistCustomAttributes(newCustomAttributes);

    // If we're in probation, version is always 1 as we're not gonna send the attributes
    const isInPushProbation = await this.probationManager.isInPushProbation();
    if (isInPushProbation) {
      await this.dataStorage.persistVersion(1);
      Log.debug(logModuleName, "User is in probation, not sending data.");
      return;
    }

    // Bump and save new version
    const newVersion = (await this.dataStorage.getVersion()) + 1;
    await this.dataStorage.persistVersion(newVersion);

    // Track InstallDataChanged event
    this.eventTracker.track(new Event(InternalSDKEvent.InstallDataChanged));

    // Scheduling ATS call
    this.scheduleAttributesSend();
  }

  /**
   * Save on IndexedDB the new custom profile attributes
   * @param attributes The new profile attributes to save
   * @private
   */
  private async persistCustomAttributes(attributes: ProfileCustomDataAttributes): Promise<void> {
    // Removing null values
    const dataToPersist = deepClone(attributes);
    for (const [key, attribute] of Object.entries(dataToPersist)) {
      if (attribute.value === null || attribute.type === ProfileAttributeType.UNKNOWN) {
        delete dataToPersist[key];
      }
    }
    // Save
    await Promise.all([
      this.dataStorage.persistAttributes(dataToPersist),
      // Data has been updated, any old transaction id is irrelevant
      this.dataStorage.removeTxid(),
      this.dataStorage.removeLastCheckTimestamp(),
    ]);
    return Promise.resolve();
  }

  /**
   * Save on IndexedDB the new native profile attributes
   * @param attributes The new profile attributes to save
   * @private
   */
  private async persistNativeAttributes(natives: ProfileNativeDataAttribute[]): Promise<boolean> {
    const parameterStore = await this.getParameterStore();
    let nativesChanged = false;
    for (const native of natives) {
      const definedIdentifier = typeof native.value === "undefined" ? null : native.value;
      switch (native.key) {
        case ProfileNativeAttributeType.LANGUAGE:
        case ProfileNativeAttributeType.REGION:
          {
            const updated = await parameterStore.setOrRemoveParameterValueIfChanged(indexedDBKeyBinder[native.key], definedIdentifier);
            if (updated) {
              nativesChanged = true;
            }
          }
          break;
        default:
          // Do nothing
          break;
      }
    }
    return nativesChanged;
  }

  // Schedule an attribute synchronization with the server.
  // VisibleForTesting
  protected scheduleAttributesSend(): void {
    void this.taskQueue.postAsync(() =>
      this.sendAttributes().catch(e => {
        Log.error(logModuleName, "Could not synchronize user data with the server:", e);
      })
    );
  }

  /**
   * Send the latest attributes to the server
   * For Install-based data model only
   * @private
   */
  private async sendAttributes(): Promise<void> {
    const profileAttributes = await this.dataStorage.getAttributes();
    const userAttributes = convertProfileDataAttributesToUserAttributes(profileAttributes);
    const userTags = convertProfileDataAttributesToUserTags(profileAttributes);
    const version = await this.dataStorage.getVersion();

    if (version < 1) {
      // No attributes to send, skip
      return;
    }

    const txid = await this.dataStorage.getTxid();
    if (txid) {
      // No need to send if we already have a txid
      return;
    }

    const response = await this.webserviceExecutor.start(new AttributesSendService(userAttributes, userTags, version));

    if (!isUnknownObject(response)) {
      throw new Error("Internal Error: bad server response (code 1)");
    }

    const responseTrid = response["trid"];
    if (!isString(responseTrid) || responseTrid.length === 0) {
      throw new Error("Internal Error: bad server response (code 2)");
    }

    const responseVersion = response["ver"];
    if (!isNumber(responseVersion)) {
      throw new Error("Internal Error: bad server response (code 3)");
    }

    // This should never happen
    if (version !== responseVersion) {
      Log.debug(logModuleName, "Server replied a txid for the wrong version, ignoring it.");
      return;
    }

    await this.dataStorage.persistTxid(responseTrid);
  }

  // VisibleForTesting
  protected scheduleAttributesCheck(): void {
    void this.taskQueue.postAsync(async () => {
      const lastCheck = await this.dataStorage.getLastCheckTimestamp();
      // Check once every 5 minutes
      if (lastCheck && lastCheck + MIN_ATTRIBUTES_CHECK_INTERVAL_MS >= Date.now()) {
        return;
      }

      await this.checkWithServer().catch(e => {
        Log.error(logModuleName, "Could not verify user data with the server:", e);
      });
    });
  }

  // VisibleForTesting
  protected async checkWithServer(): Promise<void> {
    const txid = await this.dataStorage.getTxid();
    if (!txid) {
      return;
    }

    const ver = await this.dataStorage.getVersion();
    if (ver < 1) {
      return;
    }

    const response = await this.webserviceExecutor.start(new AttributesCheckService(txid, ver));
    if (!isAttributesCheckResponse(response)) {
      throw new Error("Could not parse server response");
    }
    if (response.project_key) {
      const parameterStore = await this.getParameterStore();
      const currentProjectKey = await parameterStore.getParameterValue<string>(keysByProvider.profile.ProjectKey);
      if (currentProjectKey !== response.project_key) {
        await parameterStore.setParameterValue(keysByProvider.profile.ProjectKey, response.project_key);
        LocalEventBus.emit(LocalSDKEvent.ProjectChanged, { old: currentProjectKey, new: response.project_key }, true);
      }
    }
    response.action = response.action.toUpperCase() as typeof response.action;
    switch (response.action) {
      case "OK":
        void this.dataStorage.persistLastCheckTimestamp(Date.now());
        return;
      case "BUMP":
        {
          const currentVersion = await this.dataStorage.getVersion();
          if (response.ver >= currentVersion) {
            this.scheduleBumpVersion(currentVersion, response.ver);
          }
        }
        return;
      case "RESEND":
        void this.resendAttributes();
        return;
      case "RECHECK":
        // Not implemented on purpose
        return;
    }
  }

  protected async resendAttributes(): Promise<void> {
    await this.dataStorage.removeTxid();
    this.scheduleAttributesSend();
  }

  // VisibleForTesting
  protected scheduleBumpVersion(fromVersion: number, serverVersion: number): void {
    void this.taskQueue.postAsync(() => this.bumpVersion(fromVersion, serverVersion));
  }

  // VisibleForTesting
  protected async bumpVersion(fromVersion: number, serverVersion: number): Promise<void> {
    // Since we operate in a task queue, make sure that the bump operation is atomic:
    // we need to check that the version hasn't changed since the check!
    const currentVersion = await this.dataStorage.getVersion();
    if (currentVersion !== fromVersion) {
      Log.debug(logModuleName, "Version changed since server asked us to bump it, ignoring.");
      return;
    }

    await this.dataStorage.persistVersion(serverVersion + 1);
    await this.dataStorage.removeTxid();
    this.scheduleAttributesSend();
  }

  public async bumpProfileVersion(): Promise<boolean> {
    const parameterStore = await this.getParameterStore();
    const version = await parameterStore.getParameterValue<string>(keysByProvider.profile.UserProfileVersion);
    const intVal = version == null ? NaN : parseInt(version, 10);
    await parameterStore.setParameterValue(keysByProvider.profile.UserProfileVersion, isNaN(intVal) ? 0 : intVal + 1);
    return true;
  }

  private async getParameterStore(): Promise<ParameterStore> {
    const parameterStore = await ParameterStore.getInstance();
    return parameterStore != null ? Promise.resolve(parameterStore) : Promise.reject("parameter store null");
  }
}
