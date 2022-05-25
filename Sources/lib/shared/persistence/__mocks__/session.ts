import { IPersistenceProvider } from "../persistence-provider";

let dbInstance: InMemory | null = null;

class InMemory implements IPersistenceProvider<unknown> {
  private db: { [key: string]: unknown };

  public constructor() {
    this.db = {};
  }

  public getData(key: string): Promise<unknown | null> {
    return new Promise(resolve => {
      if (key in this.db) {
        resolve(this.db[key]);
      } else {
        resolve(null);
      }
    });
  }

  public setData(key: string, value: unknown): Promise<unknown> {
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

  public static getInstance(): Promise<InMemory> {
    return new Promise(resolve => {
      if (dbInstance instanceof InMemory) {
        resolve(dbInstance);
      } else {
        dbInstance = new InMemory();
        resolve(dbInstance);
      }
    });
  }
}

export default InMemory;
