import { isNumber, isString } from "com.batch.shared/helpers/primitive";
import { Log } from "com.batch.shared/logger";
import { IComplexPersistenceProvider } from "com.batch.shared/persistence/persistence-provider";
import { ProfileAttributeType, ProfileCustomDataAttributes } from "com.batch.shared/profile/profile-data-types";

const logModuleName = "UserDataStorage";

enum Keys {
  ProfileAttributes = "attributes",
  LegacyTagCollections = "tags",
  Version = "ver",
  Txid = "txid",
  LastCheckTimestamp = "last_atc",
}

export class UserDataStorage {
  private persistence;

  public constructor(persistence: IComplexPersistenceProvider) {
    this.persistence = persistence;
  }

  public async persistAttributes(attributes: ProfileCustomDataAttributes): Promise<void> {
    await this.persistence.setData(Keys.ProfileAttributes, attributes);
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

  public async removeAttributes(): Promise<void> {
    await this.persistence.removeData(Keys.ProfileAttributes);
  }

  public async getAttributes(): Promise<ProfileCustomDataAttributes> {
    const attributes = await this.persistence.getData<ProfileCustomDataAttributes>(Keys.ProfileAttributes);
    return attributes === null ? {} : attributes;
  }

  public async getVersion(): Promise<number> {
    const version = await this.persistence.getData<number>(Keys.Version);
    return version === null ? 0 : version;
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

  public async migrateTagsIfNeeded(): Promise<void> {
    try {
      // Getting old tags
      const tags = await this.persistence.getData<{ [key: string]: string[] }>(Keys.LegacyTagCollections);
      if (tags) {
        // Format old tags to profile array attributes
        const attributes = await this.getAttributes();
        for (const [collection, array] of Object.entries(tags)) {
          attributes[collection] = {
            type: ProfileAttributeType.ARRAY,
            value: new Set(array),
          };
        }
        // Save new attributes
        await this.persistAttributes(attributes);
        // Remove tags entry
        await this.persistence.removeData(Keys.LegacyTagCollections);
        Log.debug(logModuleName, "Legacy tags successfully migrated.");
      }
    } catch (e) {
      Log.debug(logModuleName, "Legacy tags migration failed with error.", e);
    }
  }
}
