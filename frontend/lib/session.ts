import type { Session } from "@/lib/types";

const SESSION_STORAGE_KEY = "live-platform.session";
const SESSION_EVENT_NAME = "live-platform-session";

function dispatchSessionEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EVENT_NAME));
}

export function sessionEventName() {
  return SESSION_EVENT_NAME;
}

export function loadSessionSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function parseSessionSnapshot(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: Session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  dispatchSessionEvent();
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  dispatchSessionEvent();
}
