export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Record<string, unknown>;
  const hasGlobal = Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.__TAURI_IPC__);
  if (hasGlobal) return true;
  try {
    const ua = (typeof navigator !== "undefined" && typeof navigator.userAgent === "string")
      ? navigator.userAgent
      : "";
    return /tauri/i.test(ua);
  } catch (_) {
    return false;
  }
}

export function basenameFromPath(path: string): string {
  const normalized = String(path || "");
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || normalized;
}
