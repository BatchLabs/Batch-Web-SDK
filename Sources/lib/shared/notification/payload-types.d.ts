export interface IBatchPushPayloadAction {
  // Label
  l?: string;

  // Icon URL
  i?: string;

  // Action string
  a?: string;

  // Arguments
  args?: Record<string, unknown>;
}

export interface IPushPayload {
  // Title
  title: string;

  // Body
  alert: string;

  // Batch internal data
  "com.batch"?: IBatchPushPayload;
}

export interface IBatchPushPayload {
  // Icon URL
  icu?: string;

  // Image URL
  imu?: string;

  // Small Icon (Android)
  siu?: string;

  // Tag
  ni?: string;

  // Should renotify?
  rn?: boolean;

  // Require interaction
  ri?: boolean;

  // Default action
  da?: IBatchPushPayloadAction;

  // Actions (CTAs)
  aa?: IBatchPushPayloadAction[];

  // Send ID
  i?: string | null;

  // Open Data
  od?: object | null;

  // Should send read receipt
  rr?: boolean;

  // Silent
  // As opposed to mobile OSes, a silent notification doesn't mean that it will
  // not be displayed. It is literally silent: it will not ring or vibrate,
  // but will still be showed
  sl?: boolean;
}
