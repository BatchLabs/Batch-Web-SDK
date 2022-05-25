export interface IPersistenceProvider<T> {
  getData(key: string): Promise<T | null>;
  setData(key: string, value: T): Promise<T>;
  removeData(key: string): Promise<void>;
}

// Storage provider that can return complex objects
export interface IComplexPersistenceProvider {
  getData<T>(key: string): Promise<T | null>;
  setData<T>(key: string, value: T): Promise<T>;
  removeData(key: string): Promise<void>;
}
