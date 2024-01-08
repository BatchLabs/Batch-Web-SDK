export enum UserAttributeType {
  STRING = "s",
  BOOLEAN = "b",
  INTEGER = "i",
  FLOAT = "f",
  DATE = "t",
  URL = "u",
}

export type UserDataTagCollections = {
  [key: string]: Set<string>;
};

export type UserDataAttribute = {
  value: string | number | boolean;
  type: UserAttributeType;
};

export type UserDataAttributes = {
  [key: string]: UserDataAttribute;
};
