"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicApiUrl } from "@/lib/backend-url";

/**
 * Client-side World ID verification status.
 *
 * Source of truth is the database (`users.worldId`, exposed via
 * GET /api/users/profile). This module keeps a per-session sessionStorage
 * mirror so render-time gates (chat, dashboard) can read the status
 * synchronously and unlock instantly after a successful verification —
 * without every gated component doing its own round-trip.
 */

function storageKey(userId: string): string {
  return `genie-verified:${userId}`;
}

export function isVerifiedCached(userId: string | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(storageKey(userId)) === "1";
}

export function setVerifiedCached(
  userId: string | undefined,
  value: boolean,
): void {
  if (!userId || typeof window === "undefined") return;
  const key = storageKey(userId);
  if (value) {
    window.sessionStorage.setItem(key, "1");
  } else {
    window.sessionStorage.removeItem(key);
  }
}

export interface VerificationStatus {
  /** True once the user has verified with World ID (DB-backed). */
  isVerified: boolean;
  /** True while the initial server status fetch is in flight. */
  loading: boolean;
  /** Re-fetch the server-side verification status. */
  refresh: () => Promise<void>;
  /** Optimistically mark verified (call right after a successful proof). */
  markVerifiedLocal: () => void;
}

/**
 * Reactive hook for a user's World ID verification status.
 * Seeds from the session cache for an instant value, then reconciles
 * against the server so a verification done on another device/tab shows up.
 */
export function useVerificationStatus(
  userId: string | undefined,
): VerificationStatus {
  const [isVerified, setIsVerified] = useState<boolean>(() =>
    isVerifiedCached(userId),
  );
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsVerified(false);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        getPublicApiUrl(
          `/api/users/profile?userId=${encodeURIComponent(userId)}`,
        ),
      );
      if (res.ok) {
        const data = (await res.json()) as { isVerified?: boolean };
        const verified = Boolean(data.isVerified);
        setIsVerified(verified);
        setVerifiedCached(userId, verified);
      }
    } catch {
      // Network error — keep whatever the cache gave us; gates fail closed.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setIsVerified(isVerifiedCached(userId));
    setLoading(true);
    void refresh();
  }, [userId, refresh]);

  const markVerifiedLocal = useCallback(() => {
    setIsVerified(true);
    setVerifiedCached(userId, true);
  }, [userId]);

  return { isVerified, loading, refresh, markVerifiedLocal };
}
