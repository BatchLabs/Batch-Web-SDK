// TODO: Try to figure out how to include ((api: IBatchSDK) => void) => void
export interface BatchWindow extends Window {
  batchSDK: (method: string, ...args: unknown[]) => void;
  "_com.batchsdk.web.devtool.api"?: function;
}
