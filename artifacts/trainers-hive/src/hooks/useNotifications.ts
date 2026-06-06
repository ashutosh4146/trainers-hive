import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useListMyApplications } from "@workspace/api-client-react";

export type NotificationType =
  | "trainer_shortlisted"
  | "trainer_hired"
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

function getNotificationTime(value: any) {
  return value?.updatedAt ?? value?.createdAt ?? new Date().toISOString();
}

function getRequirementTitle(application: any) {
  return application?.requirement?.title ?? application?.requirementTitle ?? "your application";
}

function getVendorName(application: any) {
  return application?.requirement?.vendorName ?? application?.vendorName ?? "the vendor";
}

function deriveTrainerApplicationNotifications(applications: any[]): AppNotification[] {
  return applications.flatMap((application) => {
    const requirementTitle = getRequirementTitle(application);
    const vendorName = getVendorName(application);
    const href = application?.status === "shortlisted" || application?.status === "hired"
      ? "/messages"
      : application?.requirementId
        ? `/requirements/${application.requirementId}`
        : "/dashboard";

    if (application?.status === "hired") {
      return [{
        id: `application-hired-${application.id}`,
        type: "trainer_hired" as const,
        title: "You were hired",
        body: `${vendorName} hired you for ${requirementTitle}. Open messages to coordinate next steps.`,
        createdAt: getNotificationTime(application),
        readAt: null,
        href,
      }];
    }

    if (application?.status === "shortlisted") {
      return [{
        id: `application-shortlisted-${application.id}`,
        type: "trainer_shortlisted" as const,
        title: "You were shortlisted",
        body: `${vendorName} shortlisted you for ${requirementTitle}. Respond quickly to improve your chance of selection.`,
        createdAt: getNotificationTime(application),
        readAt: null,
        href,
      }];
    }

    return [];
  });
}

function uniqueById(notifications: AppNotification[]) {
  const seen = new Set<string>();
  return notifications.filter((notification) => {
    if (seen.has(notification.id)) return false;
    seen.add(notification.id);
    return true;
  });
}

export function getNotificationLabel(type: NotificationType) {
  switch (type) {
    case "trainer_shortlisted":
      return "Trainer shortlisted";
    case "trainer_hired":
      return "Trainer hired";
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
      const token = localStorage.getItem("th_session_token");
      const response = await fetch("/api/notifications", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Could not load notifications");

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return [];

      return normalizeNotifications(await response.json());
    },
  });

  const { data: trainerApplications } = useListMyApplications({
    query: {
      enabled: enabled && auth?.role === "trainer",
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  const derivedNotifications = useMemo(
    () => auth?.role === "trainer" ? deriveTrainerApplicationNotifications(trainerApplications ?? []) : [],
    [auth?.role, trainerApplications],
  );

  const notifications = useMemo(
    () => uniqueById([...(query.data ?? []), ...derivedNotifications])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [query.data, derivedNotifications],
  );

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
