import { IWebservice } from "./base";
import { IWebserviceExecutor } from "./executor";

export default class StubWebserviceExecutor implements IWebserviceExecutor {
  public start(_ws: IWebservice): Promise<boolean> {
    return Promise.resolve(true);
  }
}
