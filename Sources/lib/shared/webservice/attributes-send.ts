import { UserDataAttributes, UserDataTagCollections } from "com.batch.shared/profile/user-data-types";

import BaseWebservice from "./base";

type Payload = {
  tags: {
    [key: string]: string[];
  };
  attrs: {
    [key: string]: string | number | boolean;
  };
  ver: number;
};

export class AttributesSendService extends BaseWebservice {
  private attributes: UserDataAttributes;
  private tags: UserDataTagCollections;
  private ver: number;

  public constructor(attributes: UserDataAttributes, tags: UserDataTagCollections, ver: number) {
    super();
    this.attributes = attributes;
    this.tags = tags;
    this.ver = ver;
  }

  private getPayload(): Payload {
    const payload: Payload = { tags: {}, attrs: {}, ver: this.ver };
    payload["attrs"] = this.convertAttributes(this.attributes);
    payload["tags"] = this.convertTags(this.tags);
    payload["ver"] = this.ver;

    return payload;
  }

  public getQuery(): object {
    return {
      payload: this.getPayload(),
    };
  }

  public getURLShortname(): string {
    return "ats";
  }

  private convertAttributes(attributes: UserDataAttributes): { [key: string]: string | number | boolean } {
    const attrs: { [key: string]: string | number | boolean } = {};
    for (const [key, value] of Object.entries(attributes)) {
      attrs[`${key.toLowerCase()}.${value.type}`] = value.value;
    }

    return attrs;
  }

  private convertTags(tagCollections: UserDataTagCollections): { [key: string]: string[] } {
    const outTagArrays: { [key: string]: string[] } = {};
    for (const [collection, tagSet] of Object.entries(tagCollections)) {
      outTagArrays[collection] = Array.from(tagSet);
    }
    return outTagArrays;
  }
}
