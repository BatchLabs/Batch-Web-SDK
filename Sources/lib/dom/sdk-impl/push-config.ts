import {
  IBatchSDKInternalConfiguration,
  IBatchSDKInternalTransientConfiguration,
  IPrivateBatchSDKConfiguration,
} from "com.batch.shared/sdk-config";

import { BatchSDK } from "../../../public/types/public-api";

/**
 * Whether the push module is enabled. Push is opt-out: only `false` or `null`
 * disables it; an omitted key or a settings object keeps it on.
 */
export function isPushEnabled(config: IPrivateBatchSDKConfiguration): boolean {
  const push = config.push;

  return push !== false && push !== null;
}

/**
 * Flatten the public `push` settings to the config root, resolve `pushEnabled`, and
 * drop the public `push` key. The runtime and the persisted config read push settings
 * flat (as v4 already did), so normalizing once here keeps the internal shape flat and
 * backward-compatible without a nested `push` to thread through every read.
 */
export function normalizePublicConfig(
  config: BatchSDK.ISDKConfiguration,
  push: BatchSDK.ISDKPushModuleConfiguration | undefined,
  internal: IBatchSDKInternalConfiguration,
  internalTransient: IBatchSDKInternalTransientConfiguration
): IPrivateBatchSDKConfiguration {
  const sdkConfig: IPrivateBatchSDKConfiguration = Object.assign({}, config, {
    vapidPublicKey: push?.vapidPublicKey,
    serviceWorker: push?.serviceWorker,
    smallIcon: push?.smallIcon,
    defaultIcon: push?.defaultIcon,
    pushEnabled: isPushEnabled(config),
    internal,
    internalTransient,
  });
  delete sdkConfig.push;
  return sdkConfig;
}
