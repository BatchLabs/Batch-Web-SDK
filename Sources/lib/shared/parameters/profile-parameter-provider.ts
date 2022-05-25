import BatchError from "../batch-error";
import { IPersistenceProvider } from "../persistence/persistence-provider";
import { allowedKeyByProvider } from "./keys";
import { ProfileKeys } from "./keys.profile";
import { IParameterProvider } from "./parameters";

class ProfileParameterProvider implements IParameterProvider<unknown> {
  private storage: IPersistenceProvider<unknown>;

  public constructor(storageProvider: IPersistenceProvider<unknown>) {
    this.storage = storageProvider;
  }

  public async getParameterForKey(key: ProfileKeys): Promise<unknown | null> {
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      const value = await this.storage.getData(key);
      if (typeof value === "undefined") {
        return null;
      }
      return value;
    }
    throw new BatchError(`Cannot read ${key}: it is not a managed profile key`);
  }

  public setParameterForKey<T>(key: string, value: NonNullable<T>): Promise<T> {
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      return this.storage.setData(key, value as unknown) as Promise<T>;
    }
    return Promise.reject(new BatchError(`Cannot set ${key}: it is not a managed profile key`));
  }

  public removeParameterForKey(key: string): Promise<void> {
    if (allowedKeyByProvider.profile.indexOf(key) !== -1) {
      return this.storage.removeData(key);
    }
    return Promise.reject(new BatchError(`${key} is not a managed profile key`));
  }
}
export default ProfileParameterProvider;
