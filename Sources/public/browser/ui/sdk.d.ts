// TODO: Try to figure out how to include ((api: IBatchSDK) => void) => void
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface BatchWindow extends Window {
  batchSDK: (method: string, ...args: unknown[]) => void;
  "_com.batchsdk.web.devtool.api"?: function;
}
