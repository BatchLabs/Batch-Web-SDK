import { RETRY_MAX_ATTEMPTS, RETRY_MIN_INTERVAL_MS } from "../../../config";
import { Delay } from "../helpers/timed-promise";
import { Log } from "../logger";
import { EventTrackerService } from "../webservice/event-tracker";
import { IWebserviceExecutor } from "../webservice/executor";
import HttpError from "../webservice/http-error";
import Event from "./event";
import EventDataPublic from "./event-public";
import EventPublicReplayed from "./event-public-replayed";

const FORBIDDEN_LOG_COOLDOWN = 10000; // 10s

export default class EventTracker {
  // The buffer's job will be to hold the events while the webservice executor sends them
  private buffer: Event[];
  //  ensures that only one event tracker WS runs at a time
  private attemptRunning: boolean;
  private webserviceExecutor: IWebserviceExecutor;
  private debounceDelay = 200;
  // delay the actual send after a track is called, to ensure bufferization
  private debounceSend: number;
  // Last timestamp we logged a 401 error details, to avoid spamming
  private lastForbiddenLog: number;
  // Development mode?
  private dev: boolean;

  private limit: number = 30;

  public constructor(dev: boolean, webserviceExecutor: IWebserviceExecutor) {
    this.dev = dev;
    this.buffer = [];
    this.webserviceExecutor = webserviceExecutor;
    this.attemptRunning = false;
    this.lastForbiddenLog = 0;
  }

  public track(event: Event | EventDataPublic | EventPublicReplayed): void {
    Log.debug("Event Tracker", `Tracking event '${event.name}'`);

    this.buffer.push(event);

    if (this.debounceSend) {
      clearTimeout(this.debounceSend);
    }

    this.debounceSend = self.setTimeout(() => {
      this.send();
    }, this.debounceDelay);
  }

  private send(retryCount: number = 0): boolean {
    if ((retryCount === 0 && this.attemptRunning) || this.buffer.length === 0) {
      return false;
    }

    // Sort the buffer, take the events to end and remove them from the buffer
    // They will be added back if sending fails.
    // Events starting with _ have priority
    const sortedBuffer = this.buffer.sort((a, b) => (a.name.charAt(0) === "_" ? -1 : b.name.charAt(0) === "_" ? 1 : 0));

    const eventsToSend = sortedBuffer.slice(0, this.limit);
    // Put events over the limit back into the buffer
    this.buffer = sortedBuffer.slice(this.limit, sortedBuffer.length);

    this.attemptRunning = true;
    this.webserviceExecutor
      .start(new EventTrackerService(eventsToSend))
      .then(() => {
        this.attemptRunning = false;
        this.buffer = this.buffer.filter(b => !eventsToSend?.map(e => e.id).includes(b.id));
        // try to send if we bufferized events in the meantime
        this.send();
      })
      .catch((e: unknown) => {
        this.buffer = eventsToSend.concat(this.buffer);
        // TODO: Log this, as this eats the WS error
        // TODO: Check the statuscode before retrying? Or should the executor tell more
        // Retry up to X times, and add a minimal delay between attempts
        // eslint-disable-next-line no-param-reassign
        retryCount += 1;
        if (retryCount < RETRY_MAX_ATTEMPTS) {
          Delay(RETRY_MIN_INTERVAL_MS).then(() => {
            this.send(retryCount);
          });
        } else {
          // we failed
          this.attemptRunning = false;
          if (
            e instanceof HttpError &&
            (e.response.status === 401 || e.response.status === 403) &&
            Date.now() - this.lastForbiddenLog > FORBIDDEN_LOG_COOLDOWN
          ) {
            this.logForbiddenError();
          }
        }
      });
    return true;
  }

  private logForbiddenError(): void {
    this.lastForbiddenLog = Date.now();
    Log.publicError("Error: Could not authenticate against Batch's servers");
    let log = "Is your configuration 'apiKey'/'authKey' pair correct?";
    if (this.dev) {
      log +=
        " In development mode, you also need to add the current origin to 'allowed dev origins' in the dashboard under 'Push Settings'";
    }
    Log.publicError(log);
  }
}
