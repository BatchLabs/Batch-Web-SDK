import { asBoolean } from "com.batch.shared/helpers/primitive";

export function resolveRequestNotifications(args: Record<string, unknown> | undefined): boolean {
  return asRequestForce(args?.["f"], asRequestForce(args?.["force"], false));
}

export function resolveRequestNotificationsComponent(args: Record<string, unknown> | undefined): string {
  const component = asRequestComponent(args?.["c"]) ?? asRequestComponent(args?.["component"]);
  return component ?? "native";
}

function asRequestForce(value: unknown, fallback: boolean): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return asBoolean(value, fallback);
}

function asRequestComponent(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
