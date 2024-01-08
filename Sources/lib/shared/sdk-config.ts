// Partial representation of the sdk configuration
export interface IPrivateBatchSDKConfiguration extends BatchSDK.ISDKConfiguration {
  internal?: IBatchSDKInternalConfiguration;
  internalTransient?: IBatchSDKInternalTransientConfiguration;
}

export interface IBatchSDKInternalConfiguration {
  origin?: string | null;
  referrer?: string;
}

// Transient config should not be persisted (usually for not persistable stuff)
export interface IBatchSDKInternalTransientConfiguration {
  serviceWorkerRegistrationPromise?: Promise<ServiceWorkerRegistration>;
}
