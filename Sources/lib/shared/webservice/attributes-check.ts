import BaseWebservice from "./base";

type Payload = {
  trid: string;
  ver: number;
};

export class AttributesCheckService extends BaseWebservice {
  private transactionID: string;
  private ver: number;

  public constructor(transactionID: string, ver: number) {
    super();
    this.transactionID = transactionID;
    this.ver = ver;
  }

  private getPayload(): Payload {
    return { trid: this.transactionID, ver: this.ver };
  }

  public getQuery(): object {
    return {
      payload: this.getPayload(),
    };
  }

  public getURLShortname(): string {
    return "atc";
  }
}
