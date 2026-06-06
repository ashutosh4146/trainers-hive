import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export type NotificationType =
  | "trainer_shortlisted"
  | "requirement_approved"
  | "requirement_rejected"
  | "agreement_signed"
  | "payment_released"
  | "profile_verification_update"
  | "new_application_received";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: string;
  readAt?: string | null;
  href?: string | null;
};

const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

function normalizeNotifications(payload: unknown): AppNotification[] {
  if (Array.isArray(payload)) return payload as AppNotification[];
  if (payload && typeof payload === "object") {
    const value = payload as { notifications?: unknown; items?: unknown; data?: unknown };
    if (Array.isArray(value.notifications)) return value.notifications as AppNotification[];
    if (Array.isArray(value.items)) return value.items as AppNotification[];
    if (Array.isArray(value.data)) return value.data as AppNotification[];
  }
  return [];
}

export function getNotificationLabel(type: NotificationType) {
  switch (type) {
    case "trainer_shortlisted":
      return "Trainer shortlisted";
    case "requirement_approved":
      return "Requirement approved";
    case "requirement_rejected":
      return "Requirement rejected";
    case "agreement_signed":
      return "Agreement signed";
    case "payment_released":
      return "Payment released";
    case "profile_verification_update":
      return "Profile verification";
    case "new_application_received":
      return "New application";
    default:
      return "Notification";
  }
}

export function useNotifications() {
  const { isSignedIn, auth } = useAuth();
  const enabled = isSignedIn && auth?.role !== "admin";

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/notifications", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Could not load notifications");

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return [];

      return normalizeNotifications(await response.json());
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  return {
    ...query,
    notifications,
    unreadCount,
  };
}
