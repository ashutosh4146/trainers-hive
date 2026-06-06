import React from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useListMyApplications } from "@workspace/api-client-react";
import { Briefcase, CheckCircle2, Clock, FileText, MessageSquare, XCircle } from "lucide-react";
import { ApplicationPipeline } from "@/components/ApplicationPipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUSES = ["submitted", "shortlisted", "hired", "completed", "rejected", "withdrawn"] as const;

type Status = typeof STATUSES[number];

function statusMeta(status: string) {
  switch (status) {
    case "submitted":
      return {
        label: "Under review",
        tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
        next: "Wait for vendor review. Keep applying to other relevant requirements.",
      };
    case "shortlisted":
      return {
        label: "Shortlisted",
        tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
        next: "Respond quickly, confirm availability, scope, dates, and commercials.",
      };
    case "hired":
      return {
        label: "Hired",
        tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
        next: "Align on agreement, training plan, prerequisites, and delivery schedule.",
      };
    case "completed":
      return {
        label: "Completed",
        tone: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800",
        next: "Ask the vendor for a review or endorsement if the engagement went well.",
      };
    case "rejected":
      return {
        label: "Not selected",
        tone: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
        next: "Review your profile and apply to better-matched requirements.",
      };
    case "withdrawn":
      return {
        label: "Withdrawn",
        tone: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
        next: "You withdrew this application. Continue browsing other opportunities.",
      };
    default:
      return {
        label: status || "Application",
        tone: "bg-muted text-muted-foreground border-border",
        next: "Track this application from your requirement detail page.",
      };
  }
}

function nextAction(status: string) {
  if (status === "shortlisted" || status === "hired") return "Message vendor";
  if (status === "completed") return "View details";
  if (status === "submitted") return "View application";
  return "Open";
}

export function TrainerApplicationTracker() {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();
  const { data: applications, isLoading } = useListMyApplications({
    query: { enabled: user?.role === "trainer" && location === "/dashboard" },
  });

  if (location !== "/dashboard" || user?.role !== "trainer") return null;

  const apps = applications ?? [];
  const activeApps = apps.filter((app) => app.status === "shortlisted" || app.status === "hired");
  const recentApps = [...apps]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 pt-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (apps.length === 0) return null;

  return (
    <div className="container mx-auto px-4 pt-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Application tracker
              </CardTitle>
              <CardDescription>
                Your active hiring progress and next actions across applications.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => {
                const count = apps.filter((app) => app.status === status).length;
                if (count === 0) return null;
                const meta = statusMeta(status);
                return (
                  <Badge key={status} variant="outline" className={cn("capitalize", meta.tone)}>
                    {meta.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeApps.length > 0 && (
            <div className="rounded-lg border bg-background/80 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Needs attention
              </div>
              <div className="space-y-2">
                {activeApps.slice(0, 2).map((app) => {
                  const meta = statusMeta(app.status);
                  return (
                    <div key={app.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link href={`/requirements/${app.requirementId}`} className="font-medium hover:underline">
                          {app.requirement.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{app.requirement.vendorName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{meta.next}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link href="/messages">
                            <MessageSquare className="h-3.5 w-3.5" /> Message
                          </Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link href={`/requirements/${app.requirementId}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {recentApps.map((app) => {
              const meta = statusMeta(app.status);
              const inactive = app.status === "rejected" || app.status === "withdrawn";
              return (
                <div key={app.id} className={cn("rounded-lg border bg-background/80 p-3", inactive && "opacity-80")}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/requirements/${app.requirementId}`} className="line-clamp-1 text-sm font-semibold hover:underline">
                        {app.requirement.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{app.requirement.vendorName}</p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", meta.tone)}>{meta.label}</Badge>
                  </div>

                  <ApplicationPipeline status={app.status} compact />

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {inactive ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {meta.next}
                    </span>
                  </div>

                  <Button asChild variant="outline" size="sm" className="mt-3 h-8 w-full gap-1 text-xs">
                    <Link href={app.status === "shortlisted" || app.status === "hired" ? "/messages" : `/requirements/${app.requirementId}`}>
                      {nextAction(app.status)}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              {apps.length} total application{apps.length === 1 ? "" : "s"}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="#your-applications">View all applications</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
