import { IndexedDbPersistence, IndexedDBTable } from "./indexed-db";

export class ProfilePersistence extends IndexedDbPersistence {
  public getTargetTable(): IndexedDBTable {
    return IndexedDBTable.ProfileData;
  }

  public static getInstance(): Promise<ProfilePersistence> {
    return new Promise(resolve => {
      resolve(new ProfilePersistence());
    });
  }
}
