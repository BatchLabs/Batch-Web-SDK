import { asString } from "com.batch.shared/helpers/primitive";

export interface UserTagAction {
  action: "add" | "remove";
  collection: string;
  tag: string;
}

export function resolveUserTag(args: Record<string, unknown> | undefined): UserTagAction {
  const rawAction = args?.["a"];
  const collection = asString(args?.["c"]);
  const tag = asString(args?.["t"]);

  if (!collection) {
    throw new Error("Cannot perform action: empty tag collection");
  }

  if (!tag) {
    throw new Error("Cannot perform action: empty tag value");
  }

  const action = resolveUserTagOperation(rawAction);
  return { action, collection, tag };
}

function resolveUserTagOperation(value: unknown): "add" | "remove" {
  if (value === "add") {
    return "add";
  }

  if (value === "remove") {
    return "remove";
  }

  throw new Error("Cannot perform action: invalid user tag operation");
}
