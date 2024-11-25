import { UserAttributeType } from "com.batch.shared/profile/user-data-types";

import { BatchSDK } from "../../../public/types/public-api";

// Class exposed in the Public API (which is why it has a "Batch" name, to differentiate it from the internal type
export class BatchUserAttribute implements BatchSDK.IUserAttribute {
  public constructor(
    private _type: BatchSDK.UserAttributeType,
    private _value: unknown
  ) {}

  public getType(): BatchSDK.UserAttributeType {
    return this._type;
  }

  public getValue(): unknown {
    // Dates are mutable so they should be copied
    if (this._value instanceof Date) {
      return new Date(this._value.getTime());
    }
    return this._value;
  }

  public getStringValue(): string | undefined {
    if (this._type == UserAttributeType.STRING) {
      return this._value as string;
    }
    return undefined;
  }

  public getBooleanValue(): boolean | undefined {
    if (this._type == UserAttributeType.BOOLEAN) {
      return this._value as boolean;
    }
    return undefined;
  }

  public getNumberValue(): number | undefined {
    if (this._type == UserAttributeType.INTEGER || this._type == UserAttributeType.FLOAT) {
      return this._value as number;
    }
    return undefined;
  }

  public getDateValue(): Date | undefined {
    if (this._type == UserAttributeType.DATE) {
      return new Date((this._value as Date).getTime());
    }
    return undefined;
  }

  public getURLValue(): URL | undefined {
    if (this._type == UserAttributeType.URL) {
      return new URL(URL.prototype.toString.call(this._value as URL));
    }
    return undefined;
  }
}
