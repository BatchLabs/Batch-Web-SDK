import { IndexedDbMemoryMock } from "./indexed-db-memory-mock";

let dbInstance: ProfilePersistence | null = null;

export class ProfilePersistence extends IndexedDbMemoryMock {
  public static getInstance(): Promise<ProfilePersistence> {
    return new Promise(resolve => {
      if (dbInstance instanceof ProfilePersistence) {
        resolve(dbInstance);
      } else {
        dbInstance = new ProfilePersistence();
        resolve(dbInstance);
      }
    });
  }
}
