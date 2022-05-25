import { IComplexPersistenceProvider, IPersistenceProvider } from "../persistence-provider";

export class IndexedDbMemoryMock implements IPersistenceProvider<unknown>, IComplexPersistenceProvider {
  private db: { [key: string]: unknown };

  public constructor() {
    this.db = {};
  }

  public getData<T>(key: string): Promise<T | null> {
    return new Promise(resolve => {
      if (key in this.db) {
        resolve(this.db[key] as T);
      } else {
        resolve(null);
      }
    });
  }

  public setData<T>(key: string, value: T): Promise<T> {
    return new Promise(resolve => {
      this.db[key] = value;
      resolve(value);
    });
  }

  public removeData(key: string): Promise<void> {
    return new Promise(resolve => {
      delete this.db[key];
      resolve();
    });
  }

  public _resetForTests(): void {
    this.db = {};
  }
}
