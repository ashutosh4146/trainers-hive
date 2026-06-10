import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { customFetch } from "@workspace/api-client-react";

export const UNREAD_BASE_KEY = "unread-messages";

export function getLastSeenKey(email: string) {
  return `th_msg_lastseen_${email}`;
}

const MARK_READ_EVENT = "th-mark-read";

/**
 * Call this whenever the user opens a message thread.
 * It updates the localStorage timestamp and broadcasts a window event
 * so every mounted useUnreadMessages instance refreshes its `since` state,
 * which is part of the queryKey — guaranteeing a brand-new cache entry.
 */
export function markRead(email: string) {
  const now = new Date().toISOString();
  localStorage.setItem(getLastSeenKey(email), now);
  window.dispatchEvent(
    new CustomEvent(MARK_READ_EVENT, { detail: { email, since: now } }),
  );
}

function readSince(email: string | undefined): string {
  if (!email) return new Date(0).toISOString();
  return localStorage.getItem(getLastSeenKey(email)) ?? new Date(0).toISOString();
}

export function useUnreadMessages() {
  const { isSignedIn, auth } = useAuth();
  const { toast } = useToast();
  const prevCountRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);

  const [since, setSince] = useState<string>(() => readSince(auth?.email));
  const [visibleCount, setVisibleCount] = useState(0);

  // Keep `since` in sync when auth email changes (login / role switch)
  useEffect(() => {
    setSince(readSince(auth?.email));
    prevCountRef.current = null;
    hasInitializedRef.current = false;
    setVisibleCount(0);
  }, [auth?.email]);

  // Listen for markRead() calls from any component
  useEffect(() => {
    const handler = (e: Event) => {
      const { email, since: newSince } = (e as CustomEvent<{ email: string; since: string }>).detail;
      if (email === auth?.email) {
        setSince(newSince);
        prevCountRef.current = 0;
        hasInitializedRef.current = true;
        setVisibleCount(0);
      }
    };
    window.addEventListener(MARK_READ_EVENT, handler);
    return () => window.removeEventListener(MARK_READ_EVENT, handler);
  }, [auth?.email]);

  const isEligible =
    isSignedIn &&
    (auth?.role === "trainer" || auth?.role === "vendor");

  const { data } = useQuery({
    // `since` is part of the key so a new timestamp → new cache entry → fresh fetch
    queryKey: [UNREAD_BASE_KEY, since],
    queryFn: async () => {
      return await customFetch<{ count: number }>(
        `/api/messages/unread-count?since=${encodeURIComponent(since)}`,
      );
    },
    enabled: !!isEligible,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const count = data?.count ?? 0;

  useEffect(() => {
    if (!data) return;

    // Do not show old unread messages as a red badge immediately after login.
    // The floating button badge should appear only for messages that arrive after
    // this screen has loaded, or after the user last opened the messages page.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevCountRef.current = count;
      setVisibleCount(0);
      return;
    }

    const previousCount = prevCountRef.current ?? 0;
    if (count > previousCount) {
      const diff = count - previousCount;
      setVisibleCount((current) => current + diff);
      toast({
        title: diff === 1 ? "New message" : `${diff} new messages`,
        description: "You have a new message in one of your conversations.",
      });
    } else if (count <= 0) {
      setVisibleCount(0);
    }

    prevCountRef.current = count;
  }, [data, count, toast]);

  return { count: visibleCount };
}
