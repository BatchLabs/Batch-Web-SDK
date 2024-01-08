import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import { ProfileKeys } from "com.batch.shared/parameters/keys.profile";

import ParameterStore from "../parameters/parameter-store";
const logModuleName = "probation-manager";

export enum ProbationType {
  Push = "push",
  Profile = "profile",
}

const probationDBKeyBinder = {
  [ProbationType.Push]: ProfileKeys.PushProbation,
  [ProbationType.Profile]: ProfileKeys.ProfileProbation,
};

export class ProbationManager {
  private parameterStore: ParameterStore;

  private cachedProbations: {
    push?: boolean;
    profile?: boolean;
  } = {};

  public constructor(parameterStore: ParameterStore) {
    this.parameterStore = parameterStore;
    this.init();
    LocalEventBus.subscribe(LocalSDKEvent.SubscriptionChanged, this.onSubscriptionChanged.bind(this));
  }

  /**
   * Whether the user is out of the push probation.
   */
  public async isOutOfPushProbation(): Promise<boolean> {
    return this.isOutOfProbationFor(ProbationType.Push);
  }

  /**
   * Whether the user is currently in push probation.
   */
  public async isInPushProbation(): Promise<boolean> {
    return this.isOutOfProbationFor(ProbationType.Push).then(out => !out);
  }

  /**
   * Whether the user is currently in profile probation (never logged).
   */
  public async isInProfileProbation(): Promise<boolean> {
    return this.isOutOfProbationFor(ProbationType.Profile).then(out => !out);
  }

  /**
   * Helper method to access the probation state on persistence storage
   * @param type of the probation
   * @private
   */
  private async isOutOfProbationFor(type: ProbationType): Promise<boolean> {
    if (this.cachedProbations[type]) return true;

    const outOfProbation = await this.parameterStore.getParameterValue<boolean>(probationDBKeyBinder[type]);
    this.cachedProbations[type] = Boolean(outOfProbation);
    return this.cachedProbations[type] || false;
  }

  /**
   * Helper method to init async in constructor
   * @private
   */
  private async init(): Promise<void> {
    // If the user is logged (meaning he has a custom user id) then he's out of profile probation
    const hasCustomUserId = await this.parameterStore.getParameterValue<string>(keysByProvider.profile.CustomIdentifier);
    if (hasCustomUserId !== null) {
      this.takeOutOfProbationFor(ProbationType.Profile);
    }

    // If the user has a push subscription then he's out of probation
    const hasSubscription = await this.parameterStore.getParameterValue(keysByProvider.profile.Subscription);
    if (hasSubscription !== null) {
      this.takeOutOfProbationFor(ProbationType.Push);
      return;
    }

    // Once upon a time, we saved if the user was out of probation in "probation".
    // This was confusing, as the probation is actually the opposite (user is probation by default and then gets out of it).
    // This code migrates the old key value
    const legacyProbation = await this.parameterStore.getParameterValue(keysByProvider.profile.LegacyProbation);
    if (legacyProbation === true) {
      this.takeOutOfProbationFor(ProbationType.Push);
      this.parameterStore.removeParameterValue(keysByProvider.profile.LegacyProbation);
    }
  }

  /**
   * Set a user out of probation for the given probation type
   * @param type of the probation
   * @private
   */
  private async takeOutOfProbationFor(type: ProbationType): Promise<void> {
    await this.parameterStore.setParameterValue(probationDBKeyBinder[type], true);
    this.cachedProbations[type] = true;
  }

  /**
   * trigger a local event ExitedProbation
   * @param type of the probation
   * @private
   */
  private triggerLocalEventExitedProbation(type: ProbationType): void {
    LocalEventBus.emit(LocalSDKEvent.ExitedProbation, { type }, false);
    Log.info(logModuleName, "Probation of type `" + type + "` changed");
  }

  /**
   * Listener for onSubscriptionChanged. This is the trigger to be out of the Push probation
   * @param state of the subscription
   * @private
   */
  private async onSubscriptionChanged(state: ISubscriptionState): Promise<void> {
    const currentIsOutOfProbation = await this.isOutOfProbationFor(ProbationType.Push);
    if (state.subscribed && !currentIsOutOfProbation) {
      this.takeOutOfProbationFor(ProbationType.Push);
      this.triggerLocalEventExitedProbation(ProbationType.Push);
      Log.debug(logModuleName, "exited push probation");

      // In this case we take out of probation for profile too
      this.takeOutOfProbationFor(ProbationType.Profile);
      this.triggerLocalEventExitedProbation(ProbationType.Profile);
    }
    return;
  }

  /**
   * Method called when the user just logged id.
   * This is the trigger to be out of the profile probation.
   * @private
   */
  public async onUserLoggedIn(): Promise<void> {
    const currentIsOutOfProbation = await this.isOutOfProbationFor(ProbationType.Profile);
    if (!currentIsOutOfProbation) {
      this.takeOutOfProbationFor(ProbationType.Profile);
      this.triggerLocalEventExitedProbation(ProbationType.Profile);
      Log.debug(logModuleName, "exited profile probation");
    }
    return;
  }
}
