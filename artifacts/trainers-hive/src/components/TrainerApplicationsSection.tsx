import React from "react";
import { Link } from "wouter";
import { useGetCurrentUser, useListMyApplications } from "@workspace/api-client-react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, LogOut, MessageSquare, Search, XCircle } from "lucide-react";
import { ApplicationPipeline } from "@/components/ApplicationPipeline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_ORDER = ["all", "submitted", "shortlisted", "hired", "completed", "rejected", "withdrawn"] as const;
const PAGE_SIZE = 5;

type Filter = typeof STATUS_ORDER[number];

function statusMeta(status: string) {
  switch (status) {
    case "submitted":
      return { label: "Under review", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" };
    case "shortlisted":
      return { label: "Shortlisted", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" };
    case "hired":
      return { label: "Hired", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800" };
    case "completed":
      return { label: "Completed", tone: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800" };
    case "rejected":
      return { label: "Not selected", tone: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800" };
    default:
      return { label: status || "Application", tone: "bg-muted text-muted-foreground border-border" };
  }
}

function nextStep(status: string) {
  if (status === "submitted") return "Vendor is reviewing your application.";
  if (status === "shortlisted") return "Reply quickly and confirm availability, scope, and commercials.";
  if (status === "hired") return "Coordinate agreement, dates, prerequisites, and delivery plan.";
  if (status === "completed") return "Ask for a review or endorsement from the vendor.";
  if (status === "rejected") return "Review your profile and apply to better matched opportunities.";
  if (status === "withdrawn") return "You withdrew this application. Browse new opportunities when ready.";
  return "Track progress and next steps here.";
}

function getCounts(apps: any[]) {
  return {
    submitted: apps.filter((app) => app.status === "submitted").length,
    shortlisted: apps.filter((app) => app.status === "shortlisted").length,
    hired: apps.filter((app) => app.status === "hired").length,
    completed: apps.filter((app) => app.status === "completed").length,
    rejected: apps.filter((app) => app.status === "rejected").length,
    withdrawn: apps.filter((app) => app.status === "withdrawn").length,
  };
}

function canWithdrawApplication(status: string) {
  return status === "submitted" || status === "shortlisted";
}

export function TrainerApplicationsSection() {
  const { data: user } = useGetCurrentUser();
  const { data: applications, isLoading } = useListMyApplications({
    query: { enabled: user?.role === "trainer" },
  });
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [filter, query]);

  if (user?.role !== "trainer") return null;

  const apps = applications ?? [];
  const counts = getCounts(apps);
  const attentionCount = counts.shortlisted + counts.hired;
  const filtered = apps
    .filter((app) => filter === "all" || app.status === filter)
    .filter((app) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        app.requirement.title.toLowerCase().includes(q) ||
        app.requirement.vendorName.toLowerCase().includes(q) ||
        app.status.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section id="trainer-applications-enhanced" className="pt-6 pb-8">
      <style>{`#your-applications { display: none !important; margin: 0 !important; }`}</style>
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" /> Applications
              </CardTitle>
              <CardDescription>
                One clean place to track applications, status, next steps, and actions.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === "all" ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
                )}
              >
                All: {apps.length}
              </button>
              {STATUS_ORDER.filter((status) => status !== "all").map((status) => {
                const count = counts[status as keyof typeof counts];
                if (!count) return null;
                const meta = statusMeta(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
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

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search application, vendor, or status…"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{attentionCount}</span> applications need active follow-up.
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : apps.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground opacity-40" />
              <h3 className="font-semibold">No applications yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Start applying to relevant training requirements. Your progress will appear here.
              </p>
              <Button asChild className="mt-4">
                <Link href="/requirements">Browse requirements</Link>
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No applications match your current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {pageItems.map((app) => {
                const meta = statusMeta(app.status);
                const inactive = app.status === "rejected" || app.status === "withdrawn";
                const canMessage = app.status === "shortlisted" || app.status === "hired";
                const canWithdraw = canWithdrawApplication(app.status);
                return (
                  <div
                    key={app.id}
                    className={cn(
                      "rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm",
                      inactive && "opacity-85",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <Avatar className="h-11 w-11 shrink-0 rounded-md border">
                          <AvatarImage src={app.requirement.vendorLogoUrl} />
                          <AvatarFallback className="rounded-md">V</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/requirements/${app.requirementId}`} className="font-semibold hover:underline">
                              {app.requirement.title}
                            </Link>
                            <Badge variant="outline" className={cn("capitalize", meta.tone)}>{meta.label}</Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{app.requirement.vendorName}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> Applied {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                            </span>
                            {app.requirement.deadline && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" /> Deadline {format(new Date(app.requirement.deadline), "MMM d")}
                              </span>
                            )}
                            {app.proposedRate != null && (
                              <span>Proposed ₹{Number(app.proposedRate).toLocaleString("en-IN")}</span>
                            )}
                          </div>
                          {(app as any).withdrawnReason && (
                            <p className="mt-2 text-xs italic text-muted-foreground">“{(app as any).withdrawnReason}”</p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        {canMessage && (
                          <Button asChild size="sm" variant="outline" className="gap-1.5">
                            <Link href="/messages">
                              <MessageSquare className="h-3.5 w-3.5" /> Message
                            </Link>
                          </Button>
                        )}
                        {canWithdraw && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                            <LogOut className="h-3.5 w-3.5" /> Withdraw application
                          </Button>
                        )}
                        <Button asChild size="sm">
                          <Link href={`/requirements/${app.requirementId}`}>Open</Link>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                      <ApplicationPipeline status={app.status} compact />
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                        <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                          {inactive ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          Next step
                        </div>
                        {nextStep(app.status)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
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
    </section>
  );
}
