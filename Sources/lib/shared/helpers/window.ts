/// <reference lib='dom' />

export default function safeGetWindow(): Window | null {
  if (typeof window === "object") {
    return window;
  }
  return null;
}
