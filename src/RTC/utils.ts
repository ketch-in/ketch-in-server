import { Dictionary } from "./types";

export function parseExtra(extra: unknown): Dictionary {
  if (!extra) {
    return {};
  }
  if (typeof extra === "object") {
    return { ...extra };
  }
  if (typeof extra === "string") {
    try {
      return JSON.parse(extra);
    } catch {
      console.log("parseExtra > JSON Parse Error");
    }
  }
  return {
    value: extra,
  };
}

export function wrapperCallback(title: string, callback = console.log) {
  return (...args: unknown[]) => {
    try {
      callback(...args);
    } catch (e) {
      console.log(title, e);
    }
  };
}
