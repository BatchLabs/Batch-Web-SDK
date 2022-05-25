import { IComplexPersistenceProvider, IPersistenceProvider } from "./persistence-provider";

const dbName = "BatchWebPush";

export enum IndexedDBTable {
  ProfileData = "BatchKVData",
  UserData = "BatchKVCustomData",
}

// WARNING: If you change the table schema, make sure you bump the schema version
// Also make sure you update batchsdk-shared-worker.js/batchsdk-worker-loader.js
// with the new schema!
// ONLY DO THIS WHEN BUMPING THE --> MAJOR <-- SDK VERSION,
// AND WARN DEVS THAT THEY'VE GOT TO UPDATE THE WORKERS
// Failure to do so will result in SW breakage.
const schemaVersion = 2;

export abstract class IndexedDbPersistence implements IPersistenceProvider<unknown>, IComplexPersistenceProvider {
  // The table this class will write/read from
  public abstract getTargetTable(): IndexedDBTable;

  public openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!indexedDB) {
        reject(new Error("IndexedDB is not available"));
      }
      const request = indexedDB.open(dbName, schemaVersion);
      request.onerror = err => {
        reject(err);
      };

      request.onsuccess = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        db.onversionchange = () => {
          db.close();
        };

        this.selfHeal(db);
        resolve(db);
      };

      request.onupgradeneeded = event => {
        // Do not change this schema without reading the warning at the top
        // of this file.
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStore(db);
        // @FIXME  appearently there is now way to know if the db requires an upgrade or not, so we might fire ready before
        // we finished the upgrade script
        // const keyValStore = db.createObjectStore(tableName, { keyPath: 'k' });
        // keyValStore.transaction.oncomplete = () => {
        //   dbInstance = new IndexedDbPersistence(db);
        // };
      };

      request.onblocked = () => {
        reject(new Error("IndexedDB is blocked by another tab"));
      };
    });
  }
  private createObjectStore(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(IndexedDBTable.ProfileData)) {
      db.createObjectStore(IndexedDBTable.ProfileData, { keyPath: "k" });
    }
    if (!db.objectStoreNames.contains(IndexedDBTable.UserData)) {
      db.createObjectStore(IndexedDBTable.UserData, { keyPath: "k" });
    }
  }

  private selfHeal(db: IDBDatabase): void {
    // Work around a Safari issue where 'onupgradeneeded' isn't
    // triggered but the object store is missing.
    if (db.objectStoreNames.contains(IndexedDBTable.ProfileData) && db.objectStoreNames.contains(IndexedDBTable.UserData)) {
      return;
    }
    this.createObjectStore(db);
  }

  public async getData<T>(key: string): Promise<T | null> {
    const tableName = this.getTargetTable();
    const db = await this.openDatabase();
    return new Promise<T | null>((resolve, reject) => {
      const query = db.transaction([tableName]).objectStore(tableName).get(key);
      query.onerror = reject;
      query.onsuccess = () => {
        const data = query.result;
        resolve(typeof data === "undefined" ? null : data.value);
      };
    }).finally(() => db.close());
  }

  public async setData<T>(key: string, value: T): Promise<T> {
    const tableName = this.getTargetTable();
    const db = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      const query = db.transaction([tableName], "readwrite").objectStore(tableName).put({ k: key, value });
      query.onerror = reject;
      query.onsuccess = () => resolve(value);
    }).finally(() => db.close());
  }

  public async removeData(key: string): Promise<void> {
    const tableName = this.getTargetTable();
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const query = db.transaction([tableName], "readwrite").objectStore(tableName).delete(key);
      query.onerror = reject;
      query.onsuccess = () => resolve();
    }).finally(() => db.close());
  }
}
