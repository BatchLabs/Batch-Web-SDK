import { IndexedDbMemoryMock } from "./indexed-db-memory-mock";

let dbInstance: UserDataPersistence | null = null;

export class UserDataPersistence extends IndexedDbMemoryMock {
  public static getInstance(): Promise<UserDataPersistence> {
    return new Promise(resolve => {
      if (dbInstance instanceof UserDataPersistence) {
        resolve(dbInstance);
      } else {
        dbInstance = new UserDataPersistence();
        resolve(dbInstance);
      }
    });
  }
}
