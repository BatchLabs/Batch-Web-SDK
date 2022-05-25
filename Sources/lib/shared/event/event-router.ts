import { Log } from "com.batch.shared/logger";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import { IEventDataInternalRepresentation } from "com.batch.shared/user/event-data";

import EventPersistence from "./event-persistence";
import EventPublic from "./event-public";
import EventPublicReplayed from "./event-public-replayed";
import EventTracker from "./event-tracker";

const logModuleName = "Event Router";

export default class EventRouter {
  private eventTracker: EventTracker;
  private eventPersistence: EventPersistence;
  private probationManager: ProbationManager;

  public constructor(eventTracker: EventTracker, eventPersistence: EventPersistence, probationManager: ProbationManager) {
    this.eventTracker = eventTracker;
    this.eventPersistence = eventPersistence;
    this.probationManager = probationManager;
  }

  public async route(name: string, eventData?: IEventDataInternalRepresentation): Promise<void> {
    if (await this.probationManager.isOutOfProbation()) {
      try {
        this.eventTracker.track(new EventPublic(name, eventData));
      } catch (e) {
        Log.error(logModuleName, e);
      }
    } else {
      try {
        this.eventPersistence.persist(new EventPublicReplayed(name, eventData));
      } catch (e) {
        Log.error(logModuleName, e);
      }
    }
  }
}
