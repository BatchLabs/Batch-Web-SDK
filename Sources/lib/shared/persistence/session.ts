import safeGetWindow from "../helpers/window";
import { IPersistenceProvider } from "./persistence-provider";

const safeWindow = safeGetWindow();

class Session implements IPersistenceProvider<string> {
  public getData(key: string): Promise<string | null> {
    if (safeWindow == null) {
      return Promise.reject("No session storage available");
    }
    return new Promise(resolve => resolve(safeWindow.sessionStorage.getItem(key)));
  }

  public setData(key: string, value: string): Promise<string> {
    if (safeWindow == null) {
      return Promise.reject("No session storage available");
    }
    return new Promise(resolve => {
      safeWindow.sessionStorage.setItem(key, value);
      resolve(value);
    });
  }

  public removeData(key: string): Promise<void> {
    if (safeWindow == null) {
      return Promise.reject("No session storage available");
    }
    return new Promise(resolve => {
      safeWindow.sessionStorage.removeItem(key);
      resolve();
    });
  }
}

export default Session;
