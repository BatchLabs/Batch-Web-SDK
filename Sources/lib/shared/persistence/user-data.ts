import { IndexedDbPersistence, IndexedDBTable } from "./indexed-db";

export class UserDataPersistence extends IndexedDbPersistence {
  public getTargetTable(): IndexedDBTable {
    return IndexedDBTable.UserData;
  }

  public static getInstance(): Promise<UserDataPersistence> {
    return new Promise(resolve => {
      resolve(new UserDataPersistence());
    });
  }
}
