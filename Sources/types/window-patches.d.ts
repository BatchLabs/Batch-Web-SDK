/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/interface-name-prefix */
// tslint:disable

export {};

declare global {
  interface Window {
    PushManager: any;
    Intl?: {
      DateTimeFormat: () => any;
    };
  }
}
