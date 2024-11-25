import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { ProfilePersistence } from "com.batch.shared/persistence/profile";

import deepEqual from "../helpers/deep-obj-compare";
import SessionPersistence from "../persistence/session";
import { allowedKeyByProvider } from "./keys";
import { ProfileKeys } from "./keys.profile";
import { SessionKeys } from "./keys.session";
import { SystemKeys, SystemWatchedParameter, systemWatchedParameterBinder } from "./keys.system";
import { IParameterStore } from "./parameters";
import ProfileParameterProvider from "./profile-parameter-provider";
import SessionParameterProvider from "./session-parameter-provider";
import SystemParameterProvider from "./system-parameter-provider";

export interface IProviderInstances {
  system: SystemParameterProvider;
  profile: ProfileParameterProvider;
  session: SessionParameterProvider;
}

let storeInstance: ParameterStore | null = null;

/**
 * Central meta store for getting (and setting when possible) parameter
 */
export default class ParameterStore implements IParameterStore {
  private providers: IProviderInstances;

  public constructor(p: IProviderInstances) {
    this.providers = p;
    void this.systemParameterMayHaveChanged(SystemKeys.DeviceLanguage);
    void this.systemParameterMayHaveChanged(SystemKeys.DeviceTimezone);
  }

  /**
   * Check if the device system parameter has changed since the last time we get it
   * @param key System parameter key
   * @private
   */
  private async systemParameterMayHaveChanged(key: SystemWatchedParameter): Promise<void> {
    const profileKey = systemWatchedParameterBinder[key];
    const currentValue = await this.getParameterValue(key);
    const oldValue = await this.getParameterValue(profileKey);
    if (oldValue !== currentValue) {
      await this.setParameterValue(profileKey, currentValue as NonNullable<unknown>);
      LocalEventBus.emit(LocalSDKEvent.SystemParameterChanged, { [profileKey]: currentValue }, false);
    }
  }

  /**
   * read value for a key:
   *  - resolve to the value registered for key
   *  - rejects if key is not managed by any provider
   */
  public getParameterValue<T>(key: string): Promise<T | null>;
  public getParameterValue(key: string): Promise<unknown | null> {
    if (allowedKeyByProvider.system.indexOf(key) !== -1) {
      return this.providers.system.getParameterForKey(key as SystemKeys);
    }
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      return this.providers.profile.getParameterForKey(key as ProfileKeys);
    }
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      return this.providers.session.getParameterForKey(key as SessionKeys);
    }
    return Promise.reject(`Cannot read ${key}: it is not a managed key`);
  }

  /**
   * set value for a key :
   *  - resolve to the value passed on success
   *  - rejects if key is not managed by any writable provider or if it fails to update
   */
  public async setParameterValue<T>(key: string, value: NonNullable<T>): Promise<T> {
    if (typeof value === "undefined" || value == null) {
      return Promise.reject(`Refusing to write null/unknown for ${key}. Use removeParameterValue to do so explicitly.`);
    }
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      return this.providers.profile.setParameterForKey(key, value);
    }
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      await this.providers.session.setParameterForKey(key, String(value));
      return value;
    }
    return Promise.reject(`Cannot set ${key}: it is not a managed key`);
  }

  /**
   * Remove value for a key
   */
  public removeParameterValue(key: string): Promise<void> {
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      return this.providers.profile.removeParameterForKey(key);
    }
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      return this.providers.session.removeParameterForKey(key);
    }
    return Promise.reject(`Cannot delete ${key}: it is not a managed key`);
  }

  /**
   * set value for a key if needed:
   *  - resolve to true if the key has been updated
   *  - resolve to false if the key did not need update
   *  - rejects if key is not managed by any writable provider or if it fails to update
   */
  public setOrRemoveParameterValueIfChanged(key: string, value: unknown | null | undefined): Promise<boolean> {
    // We never want to save an undefined value. If the saved value was undefined
    // this method will correct it.
    const definedValue = typeof value === "undefined" ? null : value;
    return new Promise((resolve, reject) => {
      this.getParameterValue(key).then(
        oldValue => {
          if (deepEqual(oldValue, value)) {
            resolve(false);
          } else {
            if (definedValue == null) {
              this.removeParameterValue(key)
                .then(() => resolve(true))
                .catch(reject);
            } else {
              this.setParameterValue(key, value as NonNullable<unknown>)
                .then(() => resolve(true))
                .catch(reject);
            }
          }
        },
        error => {
          reject(error);
        }
      );
    });
  }

  public async getParametersValues(keys: string[]): Promise<{ [key: string]: unknown }> {
    const promises = keys.map((key: string) => this.getParameterValue(key));
    const values = await Promise.all(promises);
    return values.reduce<Record<string, unknown>>((acc, cur, indice) => {
      acc[keys[indice]] = cur;
      return acc;
    }, {});
  }

  public static getInstance(): Promise<ParameterStore> {
    return new Promise((resolve, reject) => {
      if (storeInstance instanceof ParameterStore) {
        resolve(storeInstance);
      } else {
        ProfilePersistence.getInstance()
          .then(db => {
            storeInstance = new ParameterStore({
              profile: new ProfileParameterProvider(db),
              session: new SessionParameterProvider(new SessionPersistence()),
              system: new SystemParameterProvider(),
            });
            resolve(storeInstance);
          })
          .catch(e => reject(e));
      }
    });
  }
}
