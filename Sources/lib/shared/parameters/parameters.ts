export interface IParameterStore {
  getParametersValues(keys: string[]): Promise<{ [key: string]: unknown }>;
  getParameterValue(key: string): Promise<unknown>;
}

export interface IParameterProvider<T> {
  getParameterForKey(key: string): Promise<T | null>;
  setParameterForKey(key: string, value: T): Promise<T>;
  removeParameterForKey(key: string): Promise<void>;
}

export interface IReadonlyParameterProvider<T> {
  getParameterForKey(key: string): Promise<T | null>;
}
