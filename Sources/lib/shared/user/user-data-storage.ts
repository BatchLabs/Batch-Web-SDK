import { isNumber, isString } from "com.batch.shared/helpers/primitive";
import { IComplexPersistenceProvider } from "com.batch.shared/persistence/persistence-provider";

import { UserDataAttributes, UserDataTagCollections } from "./user-data-writer";

enum Keys {
  UserAttributes = "attributes",
  UserTagCollections = "tags",
  Version = "ver",
  Txid = "txid",
  LastCheckTimestamp = "last_atc",
}

export class UserDataStorage {
  private persistence;

  public constructor(persistence: IComplexPersistenceProvider) {
    this.persistence = persistence;
  }

  public async persistAttributes(attributes: UserDataAttributes): Promise<void> {
    await this.persistence.setData(Keys.UserAttributes, attributes);
  }

  public async persistTags(tagCollections: UserDataTagCollections): Promise<void> {
    const outTagArrays: { [key: string]: string[] } = {};
    for (const [collection, tagSet] of Object.entries(tagCollections)) {
      outTagArrays[collection] = Array.from(tagSet);
    }
    await this.persistence.setData(Keys.UserTagCollections, outTagArrays);
  }

  public async persistTxid(txid: string): Promise<void> {
    await this.persistence.setData(Keys.Txid, txid);
  }

  public async persistVersion(version: number): Promise<void> {
    await this.persistence.setData(Keys.Version, version);
  }

  public async persistLastCheckTimestamp(timestamp: number): Promise<void> {
    await this.persistence.setData(Keys.LastCheckTimestamp, timestamp);
  }

  public async removeTxid(): Promise<void> {
    await this.persistence.removeData(Keys.Txid);
  }

  public async removeLastCheckTimestamp(): Promise<void> {
    await this.persistence.removeData(Keys.LastCheckTimestamp);
  }

  public async getAttributes(): Promise<UserDataAttributes> {
    const attributes = await this.persistence.getData<UserDataAttributes>(Keys.UserAttributes);
    return attributes === null ? {} : attributes;
  }

  public async getVersion(): Promise<number> {
    const version = await this.persistence.getData<number>(Keys.Version);
    return version === null ? 0 : version;
  }

  public async getTagsAsArrays(): Promise<{ [key: string]: string[] }> {
    const tags = await this.persistence.getData<{ [key: string]: string[] }>(Keys.UserTagCollections);
    return tags === null ? {} : tags;
  }

  public async getTags(): Promise<UserDataTagCollections> {
    const tagCollections = await this.getTagsAsArrays();

    const outTagSets: UserDataTagCollections = {};
    for (const [collection, tags] of Object.entries(tagCollections)) {
      outTagSets[collection] = new Set(tags);
    }
    return outTagSets;
  }

  public async getTxid(): Promise<string | undefined> {
    const txid = await this.persistence.getData(Keys.Txid);
    if (isString(txid)) {
      return txid;
    }
    return;
  }

  public async getLastCheckTimestamp(): Promise<number | undefined> {
    const timestamp = await this.persistence.getData<number>(Keys.LastCheckTimestamp);
    if (isNumber(timestamp)) {
      return timestamp;
    }
    return;
  }
}
