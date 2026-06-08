import React from "react";
import { Link } from "wouter";
import {
  useGetPlatformStats,
  useListFeaturedTrainers,
  useListRecentRequirements,
  useListActivity,
  getGetPlatformStatsQueryKey,
  getListFeaturedTrainersQueryKey,
  getListRecentRequirementsQueryKey,
  getListActivityQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building,
  CalendarDays,
  Clock,
  ClipboardList,
  FileSignature,
  MapPin,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type PlatformStats = { vendorCount?: number; trainerCount?: number; openRequirementCount?: number; completedEngagements?: number };

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const wrapped = value as { data?: T[]; items?: T[]; results?: T[]; trainers?: T[]; requirements?: T[]; activities?: T[] };
    if (Array.isArray(wrapped.data)) return wrapped.data;
    if (Array.isArray(wrapped.items)) return wrapped.items;
    if (Array.isArray(wrapped.results)) return wrapped.results;
    if (Array.isArray(wrapped.trainers)) return wrapped.trainers;
    if (Array.isArray(wrapped.requirements)) return wrapped.requirements;
    if (Array.isArray(wrapped.activities)) return wrapped.activities;
  }
  return [];
}
function toRecord<T extends Record<string, unknown>>(value: unknown): Partial<T> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) return record.data as Partial<T>;
  if (record.result && typeof record.result === "object" && !Array.isArray(record.result)) return record.result as Partial<T>;
  if (record.stats && typeof record.stats === "object" && !Array.isArray(record.stats)) return record.stats as Partial<T>;
  return record as Partial<T>;
}
function statNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function formatDeadline(value: unknown) {
  if (!value) return "Flexible";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Flexible";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isDeadlineSoon(value: unknown) {
  if (!value) return false;
  const deadline = new Date(String(value));
  if (Number.isNaN(deadline.getTime())) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  return days >= 0 && days <= 7;
}
function requirementMode(req: any) {
  if (req.trainingMode) return String(req.trainingMode).replace("-", " ");
  if (req.remote) return "Remote";
  return "On-site";
}

function RequirementRecommendation({ req, compact = false }: { req: any; compact?: boolean }) {
  const budgetLabel = req.budget > 0 ? `₹${Number(req.budget).toLocaleString("en-IN")}` : "Discuss payout";
  const deadlineLabel = formatDeadline(req.deadline);
  const postedLabel = req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : "Recently posted";
  const soon = isDeadlineSoon(req.deadline);
  return (
    <Link href={`/requirements/${req.id}`}>
      <article className="group h-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md">
        <div className="flex h-full flex-col p-4 md:p-5">
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 shrink-0 rounded-xl border bg-background"><AvatarImage src={req.vendorLogoUrl} alt={req.vendorName} className="object-contain p-1" loading="lazy" /><AvatarFallback className="rounded-xl bg-muted text-muted-foreground"><Building className="h-5 w-5" /></AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight group-hover:text-primary">{req.title}</h3><p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><Building className="h-3 w-3 shrink-0" /> {req.vendorName || "Verified vendor"}</p></div><Badge className="shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-600">Open</Badge></div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{req.skill && <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{req.skill}</Badge>}<Badge variant="outline" className="capitalize text-muted-foreground">{requirementMode(req)}</Badge>{soon && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Closes soon</Badge>}</div>
          {!compact && req.description && <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{req.description}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs md:grid-cols-4"><div className="rounded-xl border bg-background p-3"><Clock className="mb-1.5 h-4 w-4 text-primary" /><p className="font-semibold text-foreground">{req.durationDays ?? "—"} days</p><p className="text-[11px] text-muted-foreground">Duration</p></div><div className="rounded-xl border bg-background p-3"><MapPin className="mb-1.5 h-4 w-4 text-primary" /><p className="truncate font-semibold capitalize text-foreground">{req.location || requirementMode(req)}</p><p className="text-[11px] text-muted-foreground">Location</p></div><div className="rounded-xl border bg-background p-3"><Briefcase className="mb-1.5 h-4 w-4 text-primary" /><p className="truncate font-semibold text-foreground">{budgetLabel}</p><p className="text-[11px] text-muted-foreground">Payout</p></div><div className="rounded-xl border bg-background p-3"><CalendarDays className="mb-1.5 h-4 w-4 text-primary" /><p className="font-semibold text-foreground">{deadlineLabel}</p><p className="text-[11px] text-muted-foreground">Deadline</p></div></div>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4"><p className="truncate text-xs text-muted-foreground">Posted {postedLabel}</p><span className="inline-flex items-center text-sm font-semibold text-primary">View details <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></div>
        </div>
      </article>
    </Link>
  );
}

function RecentRequirementsSection({ requirements, loading }: { requirements: any[]; loading: boolean }) {
  return <Card className="overflow-hidden border-primary/10 shadow-sm"><CardHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-background p-5 md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Public preview</Badge><Badge variant="outline" className="text-muted-foreground">Login required for details</Badge></div><CardTitle className="flex items-center gap-2 text-2xl"><BookOpen className="h-6 w-6 text-primary" /> Recent open requirements</CardTitle><CardDescription className="mt-2 max-w-2xl text-sm leading-relaxed">Browse active training opportunities before signing in. Open a requirement when you want to see full details or apply.</CardDescription></div><Button asChild className="shrink-0"><Link href="/requirements">Browse all <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></CardHeader><CardContent className="p-5 md:p-6">{loading ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div> : requirements.length > 0 ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{requirements.slice(0, 6).map((req: any) => <RequirementRecommendation key={req.id} req={req} />)}</div> : <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center"><BookOpen className="mx-auto mb-3 h-11 w-11 text-muted-foreground/40" /><p className="font-semibold">No open requirements yet</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Fresh opportunities will appear here as vendors post requirements.</p></div>}</CardContent></Card>;
}

function RecommendedForYou({ role, requirements, loading }: { role?: string; requirements: any[]; loading: boolean }) {
  const isVendor = role === "vendor";
  if (isVendor) {
    const items = [
      { title: "Post a clear requirement", description: "Add scope, skill, duration, location, budget, and deadline to attract relevant trainers.", href: "/requirements/new", icon: ClipboardList, cta: "Post requirement" },
      { title: "Review applicants", description: "Open your requirements and move applicants to shortlisted, hired, or rejected quickly.", href: "/dashboard", icon: Briefcase, cta: "Open dashboard" },
      { title: "Reply to messages", description: "Use messages to finalize availability, commercials, delivery mode, and next steps.", href: "/messages", icon: MessageSquare, cta: "Open messages" },
      { title: "Complete agreements", description: "After selection, keep agreements and payment follow-ups organized in one place.", href: "/agreements", icon: FileSignature, cta: "View agreements" },
    ];
    return <Card className="self-start border-primary/10 bg-muted/20 lg:sticky lg:top-24"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Recommended for you</CardTitle><CardDescription>Vendor actions that move hiring forward.</CardDescription></CardHeader><CardContent className="space-y-3">{items.map((item) => { const Icon = item.icon; return <Link key={item.title} href={item.href}><div className="rounded-xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p><p className="mt-2 text-xs font-medium text-primary">{item.cta} →</p></div></div></div></Link>; })}</CardContent></Card>;
  }
  return <Card className="self-start border-primary/10 bg-muted/20 lg:sticky lg:top-24"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Recommended for you</CardTitle><CardDescription>Open requirements that may be worth checking first.</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />) : requirements.length > 0 ? requirements.slice(0, 4).map((req) => <RequirementRecommendation key={req.id} req={req} compact />) : <div className="rounded-xl border border-dashed bg-background p-4 text-center"><BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" /><p className="text-sm font-medium">No recommendations yet</p><p className="mt-1 text-xs text-muted-foreground">New opportunities will appear here as vendors post requirements.</p></div>}<Button asChild variant="outline" className="w-full"><Link href="/requirements">View all requirements</Link></Button></CardContent></Card>;
}

export default function Home() {
  const { isSignedIn, auth } = useAuth();
  const isLoggedIn = isSignedIn;
  const isAdmin = auth?.role === "admin";
  const showRecommendations = isLoggedIn && !isAdmin;
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats({ query: { queryKey: getGetPlatformStatsQueryKey() }});
  const { data: featuredTrainers, isLoading: trainersLoading } = useListFeaturedTrainers({ query: { queryKey: getListFeaturedTrainersQueryKey(), enabled: isAdmin }});
  const { data: recentRequirements, isLoading: requirementsLoading } = useListRecentRequirements({ query: { queryKey: getListRecentRequirementsQueryKey() }});
  const { data: activityFeed, isLoading: activityLoading } = useListActivity({ query: { queryKey: getListActivityQueryKey(), enabled: isAdmin } });
  const platformStats = toRecord<PlatformStats>(stats);
  const featuredTrainersList = toArray(featuredTrainers);
  const recentRequirementsList = toArray(recentRequirements);
  const activityFeedList = toArray(activityFeed);
  const showStatsSection = statsLoading || !!platformStats;
  const showFeaturedTrainers = isAdmin && (trainersLoading || featuredTrainersList.length > 0);
  const showRecentRequirements = requirementsLoading || recentRequirementsList.length > 0;
  const showActivityFeed = isAdmin && (activityLoading || activityFeedList.length > 0);
  const showDataSections = showFeaturedTrainers || showRecentRequirements || showActivityFeed || showRecommendations;
  const browseRequirementsHref = "/requirements";

  return (
    <div className="w-full flex flex-col">
      <section className="relative w-full overflow-hidden border-b border-primary/20 bg-slate-900 py-20 text-slate-50 md:py-32 lg:py-40"><div className="absolute inset-0 z-0"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/40 via-slate-900 to-slate-900 opacity-80" /><div className="absolute top-0 right-0 h-full w-1/2 translate-x-1/4 opacity-10 blur-3xl"><div className="h-full w-full rounded-full bg-primary" /></div></div><div className="container relative z-10 mx-auto px-4 md:px-6"><div className="max-w-3xl"><Badge variant="outline" className="mb-6 border-primary/50 bg-primary/10 px-3 py-1 text-primary-foreground backdrop-blur-sm dark:text-white">The B2B Training Marketplace</Badge><h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl">Source top-tier <span className="text-primary">expert trainers</span> for your institution.</h1><p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">Trainers Hive is the verified infrastructure layer connecting corporate L&amp;D leaders, universities, and specialized training professionals for high-stakes engagements.</p><div className="flex flex-wrap gap-4"><Link href={browseRequirementsHref}><Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">Browse Open Requirements</Button></Link>{isAdmin && <Link href="/trainers"><Button size="lg" variant="outline" className="h-12 border-slate-700 bg-slate-800/50 px-8 text-base backdrop-blur-sm hover:bg-slate-800 hover:text-white">View Trainer Directory</Button></Link>}</div></div></div></section>
      {showStatsSection && <section className="border-b bg-muted/30 py-12"><div className="container mx-auto px-4"><div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">{statsLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex flex-col items-center justify-center space-y-2 p-6 text-center"><Skeleton className="mb-2 h-10 w-24" /><Skeleton className="h-4 w-32" /></div>) : platformStats ? <><div className="flex flex-col items-center justify-center p-6 text-center"><span className="mb-2 text-4xl font-bold text-primary">{statNumber(platformStats.vendorCount)}+</span><span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Verified Vendors</span></div><div className="flex flex-col items-center justify-center p-6 text-center"><span className="mb-2 text-4xl font-bold text-primary">{statNumber(platformStats.trainerCount)}+</span><span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Expert Trainers</span></div><div className="flex flex-col items-center justify-center p-6 text-center"><span className="mb-2 text-4xl font-bold text-primary">{statNumber(platformStats.openRequirementCount)}</span><span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Open Opportunities</span></div><div className="flex flex-col items-center justify-center p-6 text-center"><span className="mb-2 text-4xl font-bold text-primary">{statNumber(platformStats.completedEngagements)}+</span><span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Completed Engagements</span></div></> : null}</div></div></section>}
      {showDataSections && <section className="bg-background py-12 md:py-14"><div className="container mx-auto max-w-7xl px-4"><div className={showRecommendations ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" : "grid gap-6"}>{showRecentRequirements && <RecentRequirementsSection requirements={recentRequirementsList} loading={requirementsLoading} />}{showRecommendations && <RecommendedForYou role={auth?.role} requirements={recentRequirementsList} loading={requirementsLoading} />}</div></div></section>}
      {!showDataSections && <section className="bg-background py-12 md:py-14"><div className="container mx-auto max-w-7xl px-4"><RecentRequirementsSection requirements={recentRequirementsList} loading={requirementsLoading} /></div></section>}
    </div>
  );
}
