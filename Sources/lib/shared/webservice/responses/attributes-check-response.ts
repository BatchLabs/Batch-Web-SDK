import { isNumber, isString, isUnknownObject } from "com.batch.shared/helpers/primitive";

export type AttributesCheckResponse = AttributesCheckBumpResponse | AttributesCheckOtherResponse;

export interface AttributesCheckBumpResponse {
  action: "BUMP";
  ver: number;
}

export interface AttributesCheckOtherResponse {
  action: "OK" | "RESEND" | "RECHECK";
}

export function isAttributesCheckResponse(response: unknown): response is AttributesCheckResponse {
  if (!isUnknownObject(response)) {
    return false;
  }

  if (!isString(response.action)) {
    return false;
  }

  const action = response.action.toUpperCase();
  if (action !== "OK" && action !== "BUMP" && action !== "RESEND" && action !== "RECHECK") {
    return false;
  }

  if (action === "BUMP" && !isNumber(response.ver)) {
    return false;
  }

  return true;
}
