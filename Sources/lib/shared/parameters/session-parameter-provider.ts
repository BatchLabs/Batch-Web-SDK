import BatchError from "../batch-error";
import { IPersistenceProvider } from "../persistence/persistence-provider";
import { allowedKeyByProvider } from "./keys";
import { SessionKeys } from "./keys.session";
import { IParameterProvider } from "./parameters";

const KEY_PREFIX = "com.batch.";

class SessionParameterProvider implements IParameterProvider<string> {
  public storage: IPersistenceProvider<string>;

  public constructor(storageProvider: IPersistenceProvider<string>) {
    this.storage = storageProvider;
  }

  public async getParameterForKey(key: SessionKeys): Promise<string | null> {
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      const value = await this.storage.getData(KEY_PREFIX + key);
      if (typeof value === "undefined") {
        return null;
      }
      return value;
    }
    throw new BatchError(`Cannot read ${key}: it is not a managed session key`);
  }

  public setParameterForKey(key: string, value: string): Promise<string> {
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      return this.storage.setData(KEY_PREFIX + key, value);
    }
    return Promise.reject(new BatchError(`Cannot set ${key}: it is not a managed session key`));
  }

  public removeParameterForKey(key: string): Promise<void> {
    if (allowedKeyByProvider.session.indexOf(key) !== -1) {
      this.storage.removeData(KEY_PREFIX + key);
      return Promise.resolve();
    }
    return Promise.reject(new BatchError(`Cannot delete ${key}: it is not a managed session key`));
  }
}
export default SessionParameterProvider;
