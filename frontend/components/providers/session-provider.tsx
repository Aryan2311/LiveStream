"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import { clearSession as clearStoredSession, loadSessionSnapshot, parseSessionSnapshot, saveSession, sessionEventName } from "@/lib/session";
import type { Session, User } from "@/lib/types";

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoaded: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(sessionEventName(), handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(sessionEventName(), handler);
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const sessionSnapshot = useSyncExternalStore(subscribe, loadSessionSnapshot, () => null);
  const isLoaded = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const session = useMemo(() => parseSessionSnapshot(sessionSnapshot), [sessionSnapshot]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session),
      isLoaded,
      setSession: saveSession,
      clearSession: clearStoredSession,
    }),
    [isLoaded, session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return value;
}
