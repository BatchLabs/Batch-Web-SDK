import BoundedQueue from "./helpers/bounded-queue";
import deepObjectCompare from "./helpers/deep-obj-compare";
import LocalSDKEvent from "./local-sdk-events";
import { Log, LogLevel } from "./logger";

const NB_PASSED_EVENTS = 10;
const logModuleName = "local-bus";

/**
 * An event as stored by the bus
 */
export class Evt {
  /**
   * the event code
   */
  public code: LocalSDKEvent;

  /**
   * The detail object associated to this event
   */
  public detail: object;

  /**
   * Determines whether this event has been consumed
   * A consumed event will force to clear previous events of same type
   */
  public consumed: boolean;

  // ----------------------------------->

  /**
   * Creates a new event
   */
  public constructor(code: LocalSDKEvent, detail: object, consumed: boolean) {
    this.code = code;
    this.detail = detail;
    this.consumed = consumed;
  }
}

export type EventBusListener = (detail: object, event: Evt) => void;

/**
 * Bus for local events.
 * Really more convenient than the Google Bus.
 */
export class EventBus {
  private listeners: Map<string, EventBusListener[]>;
  private passedEvents: Map<string, BoundedQueue<Evt>>;

  // ----------------------------------->

  public constructor() {
    this.listeners = new Map();
    this.passedEvents = new Map();
  }

  // ----------------------------------->

  /**
   * Subscribe a new listener
   */
  public subscribe(evt: LocalSDKEvent, listener: EventBusListener): void {
    if (typeof listener !== "function" || typeof evt !== "string") {
      throw new Error("wrong parameters");
    }
    this.getListenersFor(evt).push(listener);
    Log.grouped(LogLevel.Info, logModuleName, "new listener subscribed", ["to: " + evt, listener]);
    this.emitMissedEvents(evt, listener);
  }

  /**
   * Emit a new event to all listeners.
   * - code : the code of the event
   * - detail : an object representing the detail/data of the event
   * - consumePrevious, determines whether this event is consumed
   *   and will clear all previous events for the same code.
   *   In other words, determines whether this event only will be replayed for new listeners.
   */
  public emit(code: LocalSDKEvent, detail: object | undefined | null, consumePrevious: boolean): void {
    // avoid a lot of future issues (infinite loops)
    if (code === LocalSDKEvent.All) {
      Log.warn(logModuleName, "The event * can't be triggered");
      return;
    }

    // prefer a detail empty than null
    const evt = new Evt(code, detail || {}, consumePrevious);
    const passed = this.getPassedEventsFor(code);
    const last = passed.peek();

    // we always replace a consume
    if (consumePrevious) {
      passed.clear();
      passed.push(evt);
    }

    if (!deepObjectCompare(last, evt)) {
      // keep for future subscribers and deduplication
      if (!consumePrevious) {
        passed.push(evt);
      }

      // emit events
      Log.debug(logModuleName, "emit", evt);
      (this.listeners.get(code) || []).forEach(e => e(evt.detail, evt));
      (this.listeners.get(LocalSDKEvent.All) || []).forEach(e => e(evt.detail, evt));
    } else {
      Log.debug(logModuleName, "skipped", evt);
    }
  }

  // ----------------------------------->
  // listeners

  /**
   * Returns a non null array of listeners for this event code
   */
  public getListenersFor(evt: string): EventBusListener[] {
    let listeners = this.listeners.get(evt);
    if (!listeners) {
      listeners = [];
      this.listeners.set(evt, listeners);
    }
    return listeners;
  }

  // ----------------------------------->
  // events

  /**
   * Emit missed events for a new subscriber
   */
  public emitMissedEvents(code: string, listener: EventBusListener): void {
    if (code === LocalSDKEvent.All) {
      this.passedEvents.forEach((_value, key) => this.emitMissedEvents(key, listener));
    } else if (this.passedEvents.has(code)) {
      this.getPassedEventsFor(code).forEach((evt: Evt) => listener(evt.detail, evt));
    }
  }

  /**
   * Returns a non null array of passed events for the given event code
   */
  public getPassedEventsFor(code: string): BoundedQueue<Evt> {
    let events = this.passedEvents.get(code);
    if (events == null) {
      events = new BoundedQueue(NB_PASSED_EVENTS);
      this.passedEvents.set(code, events);
    }
    return events;
  }

  /**
   * Resets the event bus.
   * For tests only.
   */
  public _resetForTests(): void {
    this.listeners.clear();
    this.passedEvents.clear();
  }
}

/**
 * Unique instance
 */
export const LocalEventBus = new EventBus();
