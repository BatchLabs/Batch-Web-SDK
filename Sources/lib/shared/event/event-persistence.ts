import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

import EventPublicReplayed from "./event-public-replayed";
import EventTracker from "./event-tracker";

export default class EventPersistence {
  private capacity: number = 20;

  private eventTracker: EventTracker;
  private parameterStore: ParameterStore;

  public constructor(parameterStore: ParameterStore, eventTracker: EventTracker) {
    this.parameterStore = parameterStore;
    this.eventTracker = eventTracker;

    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onExitedProbation.bind(this));
  }

  private async onExitedProbation(): Promise<void> {
    const events = await this.getEvents();
    for (const event of events) {
      this.eventTracker.track(event);
    }
    await this.cleanSession();
  }

  public async getEvents(): Promise<EventPublicReplayed[]> {
    const events: string | null = await this.parameterStore.getParameterValue(keysByProvider.session.Events);
    let listEvents: EventPublicReplayed[] = [];
    if (events !== null) {
      listEvents = EventPublicReplayed.fromJSON(events);
    } else {
      listEvents = [];
    }

    return listEvents;
  }

  public async persist(event: EventPublicReplayed): Promise<void> {
    const events = await this.getEvents();
    events.push(event);
    this.enforceCapacity(events);
  }

  private async cleanSession(): Promise<void> {
    await this.parameterStore.removeParameterValue(keysByProvider.session.Events);
  }

  private async enforceCapacity(events: EventPublicReplayed[]): Promise<void> {
    while (events.length > this.capacity) {
      events.shift();
    }
    await this.pushInSession(events);
  }

  private async pushInSession(events: EventPublicReplayed[]): Promise<void> {
    await this.parameterStore.setParameterValue(keysByProvider.session.Events, JSON.stringify(events));
  }
}
