import React from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useListMyApplications } from "@workspace/api-client-react";
import { Briefcase, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, MessageSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const STATUSES = ["submitted", "shortlisted", "hired", "completed", "rejected", "withdrawn"] as const;
const PAGE_SIZE = 5;

type Status = typeof STATUSES[number];
type Filter = Status | "all";

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
  if (status === "shortlisted" || status === "hired") return "Message";
  if (status === "completed") return "View";
  if (status === "submitted") return "View";
  return "Open";
}

export function TrainerApplicationTracker() {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [expanded, setExpanded] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const { data: applications, isLoading } = useListMyApplications({
    query: { enabled: user?.role === "trainer" && location === "/dashboard" },
  });

  React.useEffect(() => {
    setPage(1);
  }, [filter, expanded]);

  if (location !== "/dashboard" || user?.role !== "trainer") return null;

  const apps = applications ?? [];
  const filteredApps = (filter === "all" ? apps : apps.filter((app) => app.status === filter))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageApps = filteredApps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const attentionCount = apps.filter((app) => app.status === "shortlisted" || app.status === "hired").length;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 pt-5 pb-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (apps.length === 0) return null;

  return (
    <div className="container mx-auto max-w-6xl px-4 pt-5 pb-8">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Application tracker
              </CardTitle>
              <CardDescription>
                Compact status view. Open the dropdown only when you want to inspect applications here.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
                )}
              >
                All: {apps.length}
              </button>
              {STATUSES.map((status) => {
                const count = apps.filter((app) => app.status === status).length;
                if (count === 0) return null;
                const meta = statusMeta(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
                      meta.tone,
                      filter === status && "ring-2 ring-primary/40",
                    )}
                  >
                    {meta.label}: {count}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/75 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" /> {apps.length} total applications
              </span>
              {attentionCount > 0 && (
                <span className="text-primary font-medium">{attentionCount} need active follow-up</span>
              )}
              <span>
                Current filter: <span className="font-medium text-foreground">{filter === "all" ? "All" : statusMeta(filter).label}</span>
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => !value)} className="gap-1.5">
              {expanded ? "Hide applications" : "View all applications"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </Button>
          </div>

          {expanded && (
            <div className="rounded-lg border bg-background/80 p-3">
              {pageApps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No applications in this filter.</div>
              ) : (
                <div className="divide-y">
                  {pageApps.map((app) => {
                    const meta = statusMeta(app.status);
                    const inactive = app.status === "rejected" || app.status === "withdrawn";
                    const href = app.status === "shortlisted" || app.status === "hired" ? "/messages" : `/requirements/${app.requirementId}`;
                    return (
                      <div key={app.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/requirements/${app.requirementId}`} className="font-medium hover:underline">
                              {app.requirement.title}
                            </Link>
                            <Badge variant="outline" className={cn("capitalize", meta.tone)}>{meta.label}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{app.requirement.vendorName}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            {inactive ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                            Applied {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })} · {meta.next}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                          <Link href={href}>
                            {(app.status === "shortlisted" || app.status === "hired") && <MessageSquare className="h-3.5 w-3.5" />}
                            {nextAction(app.status)}
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredApps.length > PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredApps.length)} of {filteredApps.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 tabular-nums">{safePage} / {totalPages}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
