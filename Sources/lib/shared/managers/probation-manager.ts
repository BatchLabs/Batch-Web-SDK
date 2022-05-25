import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { keysByProvider } from "com.batch.shared/parameters/keys";

import ParameterStore from "../parameters/parameter-store";
const logModuleName = "probation-manager";

export class ProbationManager {
  private isOutOfProbationCache?: boolean;
  private parameterStore: ParameterStore;

  public constructor(parameterStore: ParameterStore) {
    this.parameterStore = parameterStore;
    this.init();
    LocalEventBus.subscribe(LocalSDKEvent.SubscriptionChanged, this.onSubscriptionChanged.bind(this));
  }

  public async isOutOfProbation(): Promise<boolean> {
    if (this.isOutOfProbationCache) return true;

    const probation = await this.parameterStore.getParameterValue(keysByProvider.profile.Probation);
    this.isOutOfProbationCache = Boolean(probation);

    return this.isOutOfProbationCache;
  }

  private async onSubscriptionChanged(state: ISubscriptionState): Promise<void> {
    const currentIsOutOfProbation = await this.isOutOfProbation();

    if (state.subscribed && !currentIsOutOfProbation) {
      this.takeOutOfProbation();
      LocalEventBus.emit(LocalSDKEvent.ExitedProbation, null, true);
      Log.debug(logModuleName, "exited probation");
    }

    return;
  }

  private async init(): Promise<void> {
    const hasSubscription = await this.parameterStore.getParameterValue(keysByProvider.profile.Subscription);
    if (hasSubscription !== null) {
      this.takeOutOfProbation();
      return;
    }

    // Once upon a time, we saved if the user was out of probation in "probation".
    // This was confusing, as the probation is actually the opposite (user is probation by default and then gets out of it).
    // This code migrades the old key value
    const legacyprobation = await this.parameterStore.getParameterValue(keysByProvider.profile.LegacyProbation);
    if (legacyprobation === true) {
      this.takeOutOfProbation();
      this.parameterStore.removeParameterValue(keysByProvider.profile.LegacyProbation);
    }
  }

  private async takeOutOfProbation(): Promise<void> {
    await this.parameterStore.setParameterValue(keysByProvider.profile.Probation, true);
    this.isOutOfProbationCache = true;
  }
}
