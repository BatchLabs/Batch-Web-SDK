// Disable code coverage on test utils, they don't need to be tested
/* istanbul ignore file */
import { IWebservice } from "com.batch.shared/webservice/base";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";

export class MockWebserviceExecutor<T> implements IWebserviceExecutor {
  private _mockedResponse: T;

  public constructor(response: T) {
    this._mockedResponse = response;
  }

  public mockResponse(response: T): void {
    this._mockedResponse = response;
  }

  public start(_: IWebservice): Promise<T> {
    return Promise.resolve(this._mockedResponse);
  }
}
