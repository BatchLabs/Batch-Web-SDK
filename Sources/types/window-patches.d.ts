/* oxlint-disable typescript/no-explicit-any */
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
