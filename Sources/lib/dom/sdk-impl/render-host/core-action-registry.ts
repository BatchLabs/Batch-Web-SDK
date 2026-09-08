import { writeClipboardText } from "com.batch.dom/render/bridge/browser-gateway";
import {
  clipboardAction,
  deeplinkAction,
  dismissAction,
  formSubmitTrackEventAction,
  groupAction,
  requestNotificationsAction,
  ShowUIComponentPort,
  TrackEventPort,
  trackEventAction,
  UpdateUserTagPort,
  userTagAction,
} from "com.batch.shared/actions/builtins";
import {
  CLIPBOARD_ACTION_ID,
  DEEPLINK_ACTION_ID,
  DISMISS_ACTION_ALIAS,
  DISMISS_ACTION_ID,
  FORM_SUBMIT_ACTION_ID,
  GROUP_ACTION_ID,
  REQUEST_NOTIFICATIONS_ACTION_ID,
  TRACK_EVENT_ACTION_ID,
  USER_TAG_ACTION_ID,
} from "com.batch.shared/actions/constants";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";

/** Ports the SDK host binds at its composition root. */
export interface CoreRenderHostPorts {
  /** Routes to the Core EventTracker. Probation and size caps apply. */
  trackEvent: TrackEventPort;
  /** Shows a UI component configured in setup(), such as the push opt-in prompt. */
  showUIComponent: ShowUIComponentPort;
  /** Adds or removes one tag of a profile tag collection. */
  updateUserTag: UpdateUserTagPort;
}

/** Composes the action registry of the SDK host, with Core-backed effects. */
export function createCoreActionExecutor(ports: CoreRenderHostPorts): MessageActionExecutor {
  const executor = new MessageActionExecutor();

  executor.register(DISMISS_ACTION_ID, dismissAction);
  executor.register(DISMISS_ACTION_ALIAS, dismissAction);
  executor.register(DEEPLINK_ACTION_ID, deeplinkAction());
  executor.register(CLIPBOARD_ACTION_ID, clipboardAction(writeClipboardText));
  executor.register(GROUP_ACTION_ID, groupAction(executor));
  executor.register(TRACK_EVENT_ACTION_ID, trackEventAction(ports.trackEvent));
  executor.register(REQUEST_NOTIFICATIONS_ACTION_ID, requestNotificationsAction(ports.showUIComponent));
  executor.register(FORM_SUBMIT_ACTION_ID, formSubmitTrackEventAction(ports.trackEvent));
  executor.register(USER_TAG_ACTION_ID, userTagAction(ports.updateUserTag));

  return executor;
}
