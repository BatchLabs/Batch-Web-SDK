import { asObject, asString } from "com.batch.shared/helpers/primitive";
import { Log } from "com.batch.shared/logger";

import { ACTION_LOG_MODULE } from "../constants";

const MAX_GROUP_ACTIONS = 10;

export interface MessageGroupedAction {
  action: string;
  args: Record<string, unknown>;
}

/** Resolves the `actions` arg of `batch.group`: caps at 10 actions and skips malformed entries. */
export function resolveGroupedActions(args: Record<string, unknown> | undefined): MessageGroupedAction[] {
  const rawActions = args?.["actions"];
  if (!Array.isArray(rawActions)) {
    Log.warn(ACTION_LOG_MODULE, "batch.group ignored: missing actions array");
    return [];
  }

  if (rawActions.length > MAX_GROUP_ACTIONS) {
    Log.warn(
      ACTION_LOG_MODULE,
      `batch.group supports at most ${MAX_GROUP_ACTIONS} actions, ignoring the remaining ${rawActions.length - MAX_GROUP_ACTIONS}`
    );
  }

  return rawActions
    .slice(0, MAX_GROUP_ACTIONS)
    .map((entry, index) => resolveGroupedActionEntry(entry, index))
    .filter((entry): entry is MessageGroupedAction => entry !== null);
}

function resolveGroupedActionEntry(entry: unknown, index: number): MessageGroupedAction | null {
  if (Array.isArray(entry)) {
    const actionName = asString(entry[0]);
    if (!actionName) {
      Log.warn(ACTION_LOG_MODULE, `batch.group: invalid action at index ${index}, skipping it`);
      return null;
    }

    return {
      action: actionName,
      args: asObject(entry[1]),
    };
  }

  const objectEntry = asObject(entry);
  const actionName = asString(objectEntry["action"]) ?? asString(objectEntry["name"]);
  if (!actionName) {
    Log.warn(ACTION_LOG_MODULE, `batch.group: invalid action at index ${index}, skipping it`);
    return null;
  }

  return {
    action: actionName,
    args: asObject(objectEntry["args"] ?? objectEntry["params"]),
  };
}
