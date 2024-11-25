import EventTracker from "com.batch.shared/event/event-tracker";
import { isString } from "com.batch.shared/helpers/primitive";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { ProbationManager, ProbationType } from "com.batch.shared/managers/probation-manager";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";
import { SystemKeys } from "com.batch.shared/parameters/keys.system";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
import { IComplexPersistenceProvider } from "com.batch.shared/persistence/persistence-provider";
import { IProfileOperation, ProfileAttributeEditor } from "com.batch.shared/profile/profile-attribute-editor";
import { ProfileNativeAttributeType } from "com.batch.shared/profile/profile-data-types";
import ProfileDataWriter from "com.batch.shared/profile/profile-data-writer";
import { buildProfileIdentifyEvent, ProfileEventBuilder } from "com.batch.shared/profile/profile-events";
import { UserCompatModule } from "com.batch.shared/profile/user-compat-module";
import { UserDataStorage } from "com.batch.shared/profile/user-data-storage";
import { IPrivateBatchSDKConfiguration } from "com.batch.shared/sdk-config";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";

import { BatchSDK } from "../../../public/types/public-api";

const logModuleName = "Profile";

export class ProfileModule implements BatchSDK.IProfile {
  /**
   * Old UserModule still used for install-based compat
   * @private
   */
  private userCompatModule: UserCompatModule;

  /**
   * Event Tracker
   * @private
   */
  private eventTracker: EventTracker;

  /**
   * User data storage object
   * @private
   */
  private userDataStorage: UserDataStorage;

  /**
   * Local instance of the custom user id
   * @private
   */
  private customUserId: string | null;

  /**
   * Probation manager
   * @private
   */
  private probationManager: ProbationManager;

  /**
   * Instance of the public profile interface
   * @private
   */
  private publicProfile: BatchSDK.IProfile;

  /**
   * SDK Configuration
   * @private
   */
  private sdkConfiguration: IPrivateBatchSDKConfiguration;

  /**
   * Constructor
   *
   * @param probationManager Probation Manager for user compat
   * @param persistence Persistence object for data storage
   * @param webserviceExecutor Webservice executor for user compat
   * @param eventTracker Event tracker instance
   */
  public constructor(
    probationManager: ProbationManager,
    persistence: IComplexPersistenceProvider,
    webserviceExecutor: IWebserviceExecutor,
    eventTracker: EventTracker,
    config: IPrivateBatchSDKConfiguration
  ) {
    this.eventTracker = eventTracker;
    this.sdkConfiguration = config;
    this.userDataStorage = new UserDataStorage(persistence);
    void this.userDataStorage.migrateTagsIfNeeded();
    this.probationManager = probationManager;
    this.userCompatModule = new UserCompatModule(probationManager, webserviceExecutor, this.userDataStorage, eventTracker);
    this.publicProfile = {
      identify: (identifier: { customId?: string | undefined } | null | undefined) => this.identify(identifier),
      edit: (callback: (editor: BatchSDK.IProfileDataEditor) => void) => this.edit(callback),
    };
    LocalEventBus.subscribe(LocalSDKEvent.SystemParameterChanged, this.onSystemParameterChanged.bind(this));
    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onExitedProbation.bind(this));
    LocalEventBus.subscribe(LocalSDKEvent.ProjectChanged, this.onProjectChanged.bind(this));
  }

  /**
   * Callback triggered when a system parameter (deviceLanguage/deviceTimezone) has changed.
   * @param param New system parameter
   * @private
   */
  //FIXME: debounce to send only one event ?
  private async onSystemParameterChanged(param: { [key: string]: string }): Promise<void> {
    Log.debug(logModuleName, "System parameter has changed", param);
    const event = new ProfileEventBuilder().withSystemParameters(param).build();
    if (event) {
      this.eventTracker.track(event);
    }
  }

  /**
   * Callback triggered when the user is out of profile probation
   * This mean he's logged in for the first time
   * @param param event parameters
   * @private
   */
  private async onExitedProbation(param: { type: ProbationType }): Promise<void> {
    if (param.type === ProbationType.Profile) {
      Log.debug(logModuleName, "User is out of profile probation, sending data.");
      await this.migrateInstallDataToProfile();
    }
  }

  /**
   * Callback triggered when the project changed.
   * @param param event parameters
   * @private
   */
  private async onProjectChanged(params: { old: string | null; new: string }): Promise<void> {
    // Migrate install data to profile only the first time
    if (params.old === null) {
      const store = await this.getParameterStore();

      // CustomID Migration
      const customId = await store.getParameterValue<string>(keysByProvider.profile.CustomIdentifier);
      if (customId !== null) {
        if (this.sdkConfiguration.migrations?.v4?.customID === false) {
          Log.debug(logModuleName, "Custom ID migration has been explicitly disabled.");
        } else {
          // User already logged-in, send identify event
          Log.debug(logModuleName, "Automatic profile identification.");
          await this.sendIdentifyEvent(customId);
        }
      }

      // Data migration
      if (this.sdkConfiguration.migrations?.v4?.customData === false) {
        Log.debug(logModuleName, "Custom data migration has been explicitly disabled.");
      } else {
        Log.debug(logModuleName, "Automatic profile data migration.");
        await this.migrateInstallDataToProfile();
      }
    }
  }

  //#region Public APIs
  /**
   * Get the installation's attributes
   *
   * Returns the public-api version of the attributes
   */
  public async getPublicAttributes(): Promise<{ [key: string]: BatchSDK.IUserAttribute }> {
    return this.userCompatModule.getPublicAttributes();
  }

  /**
   * Get the installation's tags
   *
   * Returns the public-api version of the tags
   */
  public async getPublicTagCollections(): Promise<{ [key: string]: string[] }> {
    return this.userCompatModule.getPublicTagCollections();
  }

  /**
   * Clear all custom attributes.
   * This is the equivalent of old APIs: clearAttributes + clearTags
   */
  public async clearInstallationData(): Promise<void> {
    return this.userCompatModule.clearInstallationData();
  }

  /**
   * Get the public Profile APIs
   */
  public async get(): Promise<BatchSDK.IProfile> {
    await this.sync();
    return this.publicProfile;
  }
  //#endregion

  /**
   * Private implementation of the public identify API
   * @param identifier Custom user identifier
   * @private
   */
  public async identify(identifier: { customId?: string } | null | undefined): Promise<BatchSDK.IProfile> {
    if (identifier && identifier.customId && (!isString(identifier.customId) || identifier.customId.length >= 512)) {
      return Promise.reject(new Error("Custom identifier must be a string and can’t be longer than 512 characters."));
    }
    this.customUserId = await this.handleCustomIdChanged(identifier?.customId);
    return this.publicProfile;
  }

  /**
   * Private implementation of the public edit API
   * @private
   */
  public async edit(callback: (editor: BatchSDK.IProfileDataEditor) => void): Promise<BatchSDK.IProfile> {
    if (typeof callback !== "function") {
      return this.publicProfile;
    }
    const editor = new ProfileAttributeEditor(this.customUserId != null);
    callback(editor);
    editor.markAsUnusable();

    try {
      const operations = editor.getOperations();
      await this.applyOperations(operations).catch(e => {
        Log.warn(logModuleName, "Failed to edit profile data:", e);
      });
    } catch (e) {
      Log.error(logModuleName, e);
    }
    return this.publicProfile;
  }
  //#region Private APIs

  /**
   * Get the local identified profile from IndexedDB
   * @private
   */
  private async sync(): Promise<void> {
    const p = await this.getParameterStore();
    this.customUserId = await p.getParameterValue<string>(keysByProvider.profile.CustomIdentifier);
  }

  /**
   * Apply editor's operations
   * @param operations
   * @private
   */
  private async applyOperations(operations: IProfileOperation[]): Promise<void> {
    const dataWriter = new ProfileDataWriter(false);
    const nativeAttributes = await dataWriter.applyNativeOperations(operations);
    const customAttributes = await dataWriter.applyCustomOperations(operations);

    // Install-based compatibility
    await this.userCompatModule.applyInstallOperations(operations);

    // Send profile data changed event
    const event = new ProfileEventBuilder().withCustomAttributes(customAttributes).withNativeAttributes(nativeAttributes).build();
    if (event) {
      this.eventTracker.track(event);
    }
  }

  /**
   * Handle custom id when its changed. Save it locally and trigger events.
   * @param identifier customer's id
   * @private
   */
  private async handleCustomIdChanged(identifier?: string | null | undefined): Promise<string | null> {
    const definedIdentifier = typeof identifier === "undefined" ? null : identifier;
    const parameterStore = await this.getParameterStore();
    const idChanged = await parameterStore.setOrRemoveParameterValueIfChanged(keysByProvider.profile.CustomIdentifier, definedIdentifier);

    // Send profile identify event
    await this.sendIdentifyEvent(definedIdentifier);
    if (idChanged) {
      // Send install data changed compat event
      await this.userCompatModule.notifyInstallDataChanged(definedIdentifier);
      if (definedIdentifier) {
        // Check if profile is now out of probation
        await this.probationManager.onUserLoggedIn();
      }
    }
    return definedIdentifier;
  }

  /**
   * Send a _PROFILE_IDENTIFY event
   * @param customId custom user identifier
   * @private
   */
  private async sendIdentifyEvent(customId: string | null): Promise<void> {
    const parameterStore = await this.getParameterStore();
    const installID = await parameterStore.getParameterValue<string>(keysByProvider.profile.InstallationID);
    if (installID == null) {
      throw new Error("Invalid internal state: missing installation identifier.");
    }
    const event = buildProfileIdentifyEvent(installID, customId);
    this.eventTracker.track(event);
  }

  /**
   * Migrate data attached to the current installation to the profile.
   *
   * Send a PROFILE_DATA_CHANGED event with customs and natives data (language/region/tz).
   * Should only be sent when user taking out the profile probation
   * or when the app is linked to a project the first time.
   * @param probation profile's probation
   * @private
   */
  private async migrateInstallDataToProfile(): Promise<void> {
    const store = await this.getParameterStore();
    const deviceLanguage = await store.getParameterValue<string>(SystemKeys.DeviceLanguage);
    const deviceTimezone = await store.getParameterValue<string>(SystemKeys.DeviceTimezone);
    const userLanguage = await store.getParameterValue<string>(ProfileKeys.UserLanguage);
    const userRegion = await store.getParameterValue<string>(ProfileKeys.UserRegion);
    const customAttributes = await this.userDataStorage.getAttributes();

    const event = new ProfileEventBuilder()
      .withNativeAttributes([
        {
          key: ProfileNativeAttributeType.DEVICE_LANGUAGE,
          value: deviceLanguage,
        },
        {
          key: ProfileNativeAttributeType.DEVICE_TIMEZONE,
          value: deviceTimezone,
        },
        {
          key: ProfileNativeAttributeType.LANGUAGE,
          value: userLanguage,
        },
        {
          key: ProfileNativeAttributeType.REGION,
          value: userRegion,
        },
      ])
      .withCustomAttributes(customAttributes)
      .build();
    if (event) {
      this.eventTracker.track(event);
    }
  }

  /**
   * Simple helper method to get the instance of the parameter store
   * @private
   */
  private async getParameterStore(): Promise<ParameterStore> {
    const parameterStore = await ParameterStore.getInstance();
    return parameterStore != null ? Promise.resolve(parameterStore) : Promise.reject("parameter store null");
  }
  //#endregion
}
