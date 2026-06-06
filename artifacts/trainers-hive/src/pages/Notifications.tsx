import React from "react";
import { Link, useLocation } from "wouter";
import { Bell, BadgeCheck, CheckCircle2, ClipboardCheck, CreditCard, FileSignature, InboxIcon, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, getNotificationLabel, type AppNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  const className = "h-5 w-5";
  switch (type) {
    case "trainer_shortlisted":
      return <UserCheck className={className} />;
    case "requirement_approved":
    case "requirement_rejected":
      return <ClipboardCheck className={className} />;
    case "agreement_signed":
      return <FileSignature className={className} />;
    case "payment_released":
      return <CreditCard className={className} />;
    case "profile_verification_update":
      return <BadgeCheck className={className} />;
    case "new_application_received":
      return <InboxIcon className={className} />;
    default:
      return <CheckCircle2 className={className} />;
  }
}

export default function Notifications() {
  const [, navigate] = useLocation();
  const { notifications, unreadCount, isLoading, isError } = useNotifications();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Marketplace updates for applications, approvals, agreements, payments, and verification.
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="text-sm font-medium text-primary">
              {unreadCount} unread
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {isLoading ? (
            <div className="divide-y">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-5">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full max-w-md" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground opacity-30" />
              <h2 className="mt-4 text-lg font-semibold">Could not load notifications</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Please refresh the page or try again later.
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <Bell className="h-9 w-9" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No notifications yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Future updates like trainer shortlists, requirement approvals, signed agreements, released payments, verification changes, and new applications will appear here.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/messages">Open messages</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => notification.href ? navigate(notification.href) : undefined}
                  className={cn(
                    "flex w-full gap-4 p-5 text-left transition-colors",
                    notification.href ? "hover:bg-accent/50" : "cursor-default",
                    !notification.readAt && "bg-primary/5",
                  )}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <NotificationIcon type={notification.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{notification.title || getNotificationLabel(notification.type)}</span>
                      {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                    {notification.body && (
                      <span className="mt-1 block text-sm text-muted-foreground">{notification.body}</span>
                    )}
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
