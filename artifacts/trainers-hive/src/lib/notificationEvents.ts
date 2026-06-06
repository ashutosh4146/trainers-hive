export type MarketplaceNotificationType =
  | "trainer_shortlisted"
  | "requirement_approved"
  | "requirement_rejected"
  | "agreement_signed"
  | "payment_released"
  | "profile_verification_update"
  | "new_application_received";

export type MarketplaceNotificationPayload = {
  id: string;
  type: MarketplaceNotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export const NOTIFICATION_EVENT_EXAMPLES: Record<MarketplaceNotificationType, { title: string; href: string }> = {
  trainer_shortlisted: {
    title: "Trainer shortlisted",
    href: "/requirements/:requirementId",
  },
  requirement_approved: {
    title: "Requirement approved",
    href: "/requirements/:requirementId",
  },
  requirement_rejected: {
    title: "Requirement rejected",
    href: "/requirements/:requirementId",
  },
  agreement_signed: {
    title: "Agreement signed",
    href: "/agreements",
  },
  payment_released: {
    title: "Payment released",
    href: "/agreements",
  },
  profile_verification_update: {
    title: "Profile verification update",
    href: "/profile",
  },
  new_application_received: {
    title: "New application received",
    href: "/requirements/:requirementId",
  },
};
