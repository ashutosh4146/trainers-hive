import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useGetCurrentUser,
  useGetTrainer,
  useGetVendor,
  useListMyAgreements,
  useListMyApplications,
  useListRequirements,
} from "@workspace/api-client-react";

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

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const wrapped = value as { data?: T[]; items?: T[]; results?: T[]; requirements?: T[]; agreements?: T[] };
    if (Array.isArray(wrapped.data)) return wrapped.data;
    if (Array.isArray(wrapped.items)) return wrapped.items;
    if (Array.isArray(wrapped.results)) return wrapped.results;
    if (Array.isArray(wrapped.requirements)) return wrapped.requirements;
    if (Array.isArray(wrapped.agreements)) return wrapped.agreements;
  }
  return [];
}

function getNotificationTime(value: any) {
  return value?.updatedAt ?? value?.completedAt ?? value?.createdAt ?? new Date().toISOString();
}

function getRequirementTitle(application: any) {
  return application?.requirement?.title ?? application?.requirementTitle ?? application?.title ?? "your application";
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
      return [{ id: `application-hired-${application.id}`, type: "trainer_hired" as const, title: "You were hired", body: `${vendorName} hired you for ${requirementTitle}. Open messages to coordinate next steps.`, createdAt: getNotificationTime(application), readAt: null, href }];
    }

    if (application?.status === "shortlisted") {
      return [{ id: `application-shortlisted-${application.id}`, type: "trainer_shortlisted" as const, title: "You were shortlisted", body: `${vendorName} shortlisted you for ${requirementTitle}. Respond quickly to improve your chance of selection.`, createdAt: getNotificationTime(application), readAt: null, href }];
    }

    if (application?.status === "submitted") {
      return [{ id: `application-submitted-${application.id}`, type: "new_application_received" as const, title: "Application submitted", body: `Your application for ${requirementTitle} is now with ${vendorName}.`, createdAt: getNotificationTime(application), readAt: null, href }];
    }

    return [];
  });
}

function deriveVendorRequirementNotifications(requirements: any[], vendorId?: string): AppNotification[] {
  return requirements.filter((requirement) => !vendorId || requirement?.vendorId === vendorId).flatMap((requirement) => {
    const list: AppNotification[] = [];
    const title = requirement?.title ?? "your requirement";
    const href = requirement?.id ? `/requirements/${requirement.id}` : "/dashboard";
    const applicationCount = Number(requirement?.applicationCount ?? 0);

    if (applicationCount > 0) {
      list.push({ id: `requirement-applications-${requirement.id}-${applicationCount}`, type: "new_application_received", title: applicationCount === 1 ? "New application received" : `${applicationCount} applications received`, body: `${title} has ${applicationCount} trainer application${applicationCount === 1 ? "" : "s"}.`, createdAt: getNotificationTime(requirement), readAt: null, href });
    }

    if (requirement?.status === "open" && !requirement?.hidden && !requirement?.flagged) {
      list.push({ id: `requirement-approved-${requirement.id}`, type: "requirement_approved", title: "Requirement is live", body: `${title} is approved and visible to trainers.`, createdAt: getNotificationTime(requirement), readAt: null, href });
    }

    if (requirement?.hidden || requirement?.flagged) {
      list.push({ id: `requirement-rejected-${requirement.id}`, type: "requirement_rejected", title: requirement?.flagged ? "Requirement needs review" : "Requirement not visible", body: requirement?.flagReason || `${title} needs admin review.`, createdAt: getNotificationTime(requirement), readAt: null, href });
    }

    return list;
  });
}

function deriveAgreementNotifications(agreements: any[]): AppNotification[] {
  return agreements.flatMap((agreement) => {
    const list: AppNotification[] = [];
    const title = agreement?.requirementTitle ?? "the engagement";
    const counterparty = agreement?.counterpartyName ?? "the other party";
    const href = "/agreements";

    if (agreement?.status === "accepted") {
      list.push({ id: `agreement-signed-${agreement.id}`, type: "agreement_signed", title: "Agreement signed", body: `Agreement for ${title} is signed with ${counterparty}.`, createdAt: getNotificationTime(agreement), readAt: null, href });
    }

    const paidAmount = Number(agreement?.paidAmount ?? 0);
    if (paidAmount > 0) {
      list.push({ id: `agreement-payment-${agreement.id}-${paidAmount}`, type: "payment_released", title: "Payment recorded", body: `Payment has been recorded for ${title}.`, createdAt: getNotificationTime(agreement), readAt: null, href });
    }

    return list;
  });
}

function deriveVerificationNotifications(role: string | undefined, profile: any): AppNotification[] {
  if (!role || !profile || typeof profile?.verified !== "boolean") return [];
  return [{ id: `profile-verification-${role}-${profile.id}-${profile.verified ? "yes" : "no"}`, type: "profile_verification_update", title: profile.verified ? "Profile verified" : "Profile verification pending", body: role === "vendor" ? (profile.verified ? "Your organisation profile is verified." : "Your organisation profile is not verified yet.") : (profile.verified ? "Your trainer profile is verified." : "Your trainer profile is not verified yet."), createdAt: getNotificationTime(profile), readAt: null, href: "/profile" }];
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
    case "trainer_shortlisted": return "Trainer shortlisted";
    case "trainer_hired": return "Trainer hired";
    case "requirement_approved": return "Requirement approved";
    case "requirement_rejected": return "Requirement rejected";
    case "agreement_signed": return "Agreement signed";
    case "payment_released": return "Payment released";
    case "profile_verification_update": return "Profile verification";
    case "new_application_received": return "New application";
    default: return "Notification";
  }
}

export function useNotifications() {
  const { isSignedIn, auth } = useAuth();
  const enabled = isSignedIn && auth?.role !== "admin";
  const { data: currentUser } = useGetCurrentUser({ query: { enabled } });

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const token = localStorage.getItem("th_session_token");
      const response = await fetch("/api/notifications", { method: "GET", headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Could not load notifications");
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return [];
      return normalizeNotifications(await response.json());
    },
  });

  const { data: trainerApplications } = useListMyApplications({ query: { enabled: enabled && auth?.role === "trainer", refetchInterval: 60_000, refetchOnWindowFocus: true } });
  const { data: requirements } = useListRequirements({}, { query: { enabled: enabled && auth?.role === "vendor", refetchInterval: 60_000, refetchOnWindowFocus: true } });
  const { data: agreements } = useListMyAgreements({ query: { enabled, refetchInterval: 60_000, refetchOnWindowFocus: true } });
  const { data: trainerProfile } = useGetTrainer(currentUser?.trainerId ?? "", { query: { enabled: enabled && auth?.role === "trainer" && !!currentUser?.trainerId, refetchInterval: 60_000, refetchOnWindowFocus: true } });
  const { data: vendorProfile } = useGetVendor(currentUser?.vendorId ?? "", { query: { enabled: enabled && auth?.role === "vendor" && !!currentUser?.vendorId, refetchInterval: 60_000, refetchOnWindowFocus: true } });

  const derivedNotifications = useMemo(() => {
    const derived: AppNotification[] = [];
    if (auth?.role === "trainer") {
      derived.push(...deriveTrainerApplicationNotifications(toArray(trainerApplications)));
      derived.push(...deriveVerificationNotifications(auth.role, trainerProfile));
    }
    if (auth?.role === "vendor") {
      derived.push(...deriveVendorRequirementNotifications(toArray(requirements), currentUser?.vendorId));
      derived.push(...deriveVerificationNotifications(auth.role, vendorProfile));
    }
    derived.push(...deriveAgreementNotifications(toArray(agreements)));
    return derived;
  }, [auth?.role, trainerApplications, requirements, currentUser?.vendorId, trainerProfile, vendorProfile, agreements]);

  const notifications = useMemo(() => uniqueById([...(query.data ?? []), ...derivedNotifications]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [query.data, derivedNotifications]);
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.readAt).length, [notifications]);

  return { ...query, notifications, unreadCount };
}
