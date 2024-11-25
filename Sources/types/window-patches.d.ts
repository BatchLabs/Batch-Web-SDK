/* eslint-disable @typescript-eslint/no-explicit-any */
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
