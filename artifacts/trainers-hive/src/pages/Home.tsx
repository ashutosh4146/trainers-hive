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
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { ArrowRight, BookOpen, Briefcase, Star, MapPin, Building, Activity, Clock, ShieldCheck, Sparkles, MessageSquare, FileSignature, ClipboardList } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

type PlatformStats = {
  vendorCount?: number;
  trainerCount?: number;
  openRequirementCount?: number;
  completedEngagements?: number;
};

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

function statNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function RequirementRecommendation({ req }: { req: any }) {
  const budgetLabel = req.budget > 0
    ? `₹${Number(req.budget).toLocaleString("en-IN")}`
    : req.trainingMode ?? "Discuss payout";
  const deadlineLabel = req.deadline ? new Date(req.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Flexible";

  return (
    <Link href={`/requirements/${req.id}`}>
      <div className="group rounded-xl border bg-background p-4 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0 rounded-lg border bg-card">
            <AvatarImage src={req.vendorLogoUrl} alt={req.vendorName} className="object-contain p-1" loading="lazy" />
            <AvatarFallback className="rounded-lg bg-muted text-muted-foreground"><Building className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{req.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{req.vendorName}</p>
              </div>
              <span className="hidden shrink-0 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary sm:inline-flex">
                Open
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{req.skill}</Badge>
              {req.remote && <Badge variant="outline">Remote</Badge>}
              {req.applicationCount != null && <Badge variant="outline" className="text-muted-foreground">{req.applicationCount} applicants</Badge>}
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/20 text-center text-xs">
              <div className="px-2 py-2">
                <p className="font-semibold text-foreground">{req.durationDays ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">days</p>
              </div>
              <div className="border-l px-2 py-2">
                <p className="truncate font-semibold text-foreground">{budgetLabel}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">budget</p>
              </div>
              <div className="border-l px-2 py-2">
                <p className="truncate font-semibold text-foreground">{deadlineLabel}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">deadline</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
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

    return (
      <Card className="sticky top-24 border-primary/10 bg-muted/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Recommended for you</CardTitle>
          <CardDescription>Vendor actions that move hiring forward.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href}>
                <div className="rounded-xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                      <p className="mt-2 text-xs font-medium text-primary">{item.cta} →</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-24 border-primary/10 bg-muted/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Recommended for you</CardTitle>
        <CardDescription>Open requirements that may be worth checking first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : requirements.length > 0 ? (
          requirements.slice(0, 4).map((req) => <RequirementRecommendation key={req.id} req={req} />)
        ) : (
          <div className="rounded-xl border border-dashed bg-background p-4 text-center">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No recommendations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">New opportunities will appear here as vendors post requirements.</p>
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/requirements">View all requirements</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { isSignedIn, auth } = useAuth();
  const isLoggedIn = isSignedIn;
  const isAdmin = auth?.role === "admin";
  const showRecommendations = isLoggedIn && !isAdmin;

  const { data: stats, isLoading: statsLoading } = useGetPlatformStats({ query: { queryKey: getGetPlatformStatsQueryKey() }});
  const { data: featuredTrainers, isLoading: trainersLoading } = useListFeaturedTrainers({ query: { queryKey: getListFeaturedTrainersQueryKey(), enabled: isAdmin }});
  const { data: recentRequirements, isLoading: requirementsLoading } = useListRecentRequirements({ query: { queryKey: getListRecentRequirementsQueryKey() }});
  const { data: activityFeed, isLoading: activityLoading } = useListActivity({
    query: { queryKey: getListActivityQueryKey(), enabled: isAdmin },
  });

  const platformStats = toRecord<PlatformStats>(stats);
  const featuredTrainersList = toArray(featuredTrainers);
  const recentRequirementsList = toArray(recentRequirements);
  const activityFeedList = toArray(activityFeed);

  const showStatsSection = statsLoading || !!platformStats;
  const showFeaturedTrainers = isAdmin && (trainersLoading || featuredTrainersList.length > 0);
  const showRecentRequirements = isLoggedIn && (requirementsLoading || recentRequirementsList.length > 0);
  const showActivityFeed = isAdmin && (activityLoading || activityFeedList.length > 0);
  const showDataSections = showFeaturedTrainers || showRecentRequirements || showActivityFeed || showRecommendations;
  const browseRequirementsHref = isLoggedIn ? "/requirements" : "/login";

  return (
    <div className="w-full flex flex-col">
      <section className="relative w-full py-20 md:py-32 lg:py-40 bg-slate-900 text-slate-50 overflow-hidden border-b border-primary/20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/40 via-slate-900 to-slate-900 opacity-80" />
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none transform translate-x-1/4" style={{ filter: "blur(72px)" }}>
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full fill-primary" aria-hidden="true">
              <path d="M45.7,-76.1C58.9,-69.3,69.1,-55.3,77.7,-40.8C86.3,-26.2,93.4,-11.1,91.8,3.2C90.2,17.4,79.9,30.8,70.1,43.2C60.3,55.5,51.1,66.8,39,73.5C26.9,80.1,12,82.2,-3,87.3C-18.1,92.5,-33.4,100.8,-46.8,96.3C-60.2,91.8,-71.7,74.5,-79.6,57.1C-87.4,39.6,-91.7,22.1,-91.9,4.4C-92.1,-13.2,-88.2,-30.9,-79.1,-46.2C-70.1,-61.4,-56.1,-74.3,-41.2,-80.5C-26.2,-86.6,-10.4,-90.1,3.4,-95.9C17.2,-101.8,32.5,-82.9,45.7,-76.1Z" transform="translate(100 100)" />
            </svg>
          </div>
        </div>

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 border-primary/50 text-primary-foreground dark:text-white bg-primary/10 px-3 py-1 backdrop-blur-sm">
              The B2B Training Marketplace
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Source top-tier <span className="text-primary">expert trainers</span> for your institution.
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed">
              Trainers Hive is the verified infrastructure layer connecting corporate L&amp;D leaders, universities, and specialized training professionals for high-stakes engagements.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={browseRequirementsHref}>
                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                  Browse Open Requirements
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/trainers">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-white backdrop-blur-sm">
                    View Trainer Directory
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {showStatsSection && (
        <section className="py-12 bg-muted/30 border-b">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <Skeleton className="h-10 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))
              ) : platformStats ? (
                <>
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-4xl font-bold text-primary mb-2">{statNumber(platformStats.vendorCount)}+</span>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Verified Vendors</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-4xl font-bold text-primary mb-2">{statNumber(platformStats.trainerCount)}+</span>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Expert Trainers</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-4xl font-bold text-primary mb-2">{statNumber(platformStats.openRequirementCount)}</span>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Opportunities</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-4xl font-bold text-primary mb-2">{statNumber(platformStats.completedEngagements)}+</span>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed Engagements</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {showDataSections && (
        <div className="container mx-auto px-4 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-3 gap-12">
          {(showFeaturedTrainers || showRecentRequirements) && (
            <div className="lg:col-span-2 space-y-20">
              {showFeaturedTrainers && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold tracking-tight">Featured Experts</h2>
                    <Link href="/trainers">
                      <Button variant="ghost" className="group">
                        View all <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {trainersLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                          <CardHeader className="flex flex-row items-start gap-4 pb-2">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
                          </CardHeader>
                          <CardContent className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></CardContent>
                        </Card>
                      ))
                    ) : (
                      featuredTrainersList.map((trainer) => {
                        const subSkills = Array.isArray(trainer.subSkills) ? trainer.subSkills : [];
                        return (
                          <Link key={trainer.id} href={`/trainers/${trainer.id}`}>
                            <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group flex flex-col">
                              <CardHeader className="flex flex-row items-start gap-4 pb-2">
                                <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} className="h-12 w-12 border-2 border-primary/10" />
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-lg flex items-center gap-2 truncate">
                                    {trainer.name}
                                    {trainer.verified && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 px-1.5 py-0">Verified</Badge>}
                                  </CardTitle>
                                  <CardDescription className="truncate text-sm text-muted-foreground mt-1">{trainer.headline}</CardDescription>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 flex-1">
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                  <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary">{trainer.mainSkill}</Badge>
                                  {subSkills.slice(0, 2).map((skill: string) => <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">{skill}</Badge>)}
                                  {subSkills.length > 2 && <Badge variant="outline" className="font-normal text-muted-foreground">+{subSkills.length - 2}</Badge>}
                                </div>
                                <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500 fill-amber-500" /><span className="font-medium text-foreground">{Number(trainer.rating ?? 0).toFixed(1)}</span><span>({trainer.reviewCount ?? 0})</span></div>
                                  <div className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /><span>{trainer.experienceYears ?? 0}y exp</span></div>
                                  <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /><span className="truncate">{trainer.location}</span></div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>
              )}
              {showRecentRequirements && (
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold tracking-tight">Recent Opportunities</h2>
                    <Link href="/requirements">
                      <Button variant="ghost" className="group">
                        View all <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {requirementsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)
                    ) : (
                      recentRequirementsList.map((req) => (
                        <Link key={req.id} href={`/requirements/${req.id}`}>
                          <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group">
                            <CardContent className="p-6">
                              <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                                <Avatar className="h-12 w-12 rounded-md border bg-card">
                                  <AvatarImage src={req.vendorLogoUrl} alt={req.vendorName} className="object-contain p-1" loading="lazy" />
                                  <AvatarFallback className="rounded-md bg-muted text-muted-foreground"><Building className="h-6 w-6" /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div>
                                    <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">{req.title}</h3>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="font-medium text-foreground">{req.vendorName}</span>
                                      {req.vendorVerified && (
                                        <Tooltip>
                                          <TooltipTrigger asChild><span className="inline-flex items-center text-primary cursor-default"><ShieldCheck className="h-3.5 w-3.5" /></span></TooltipTrigger>
                                          <TooltipContent>This company is verified by Trainers Hive</TooltipContent>
                                        </Tooltip>
                                      )}
                                      <span>•</span><span className="truncate">{req.location} {req.remote && "(Remote Optional)"}</span>
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /><span className="font-medium text-foreground">{req.skill}</span></div>
                                    <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /><span>{req.durationDays} days</span></div>
                                    <div className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /><span className="font-medium text-foreground capitalize">{req.budget > 0 ? `₹${Number(req.budget).toLocaleString("en-IN")}${req.feeType === "negotiable" ? " (Negotiable)" : ""}` : req.trainingMode ?? "Discuss payout"}</span></div>
                                  </div>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end justify-between mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0">
                                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 whitespace-nowrap">{req.applicationCount} applications</Badge>
                                  <span className="text-xs text-muted-foreground sm:mt-2">Due {new Date(req.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
          {showRecommendations && <RecommendedForYou role={auth?.role} requirements={recentRequirementsList} loading={requirementsLoading} />}
          {showActivityFeed && (
            <div className={!showFeaturedTrainers && !showRecentRequirements ? "lg:col-span-3" : undefined}>
              <Card className="sticky top-24 bg-muted/20 border-border">
                <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Live Platform Activity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {activityLoading ? (
                      Array.from({ length: 5 }).map((_, i) => <div key={i} className="relative flex items-start gap-4"><Skeleton className="h-10 w-10 rounded-full shrink-0 z-10" /><div className="space-y-2 flex-1 pt-1"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>)
                    ) : (
                      activityFeedList.map((activity) => (
                        <div key={activity.id} className="relative flex items-start gap-4 group animate-in fade-in slide-in-from-right-2 duration-200">
                          <div className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-border group-last:hidden" />
                          <Avatar className="h-10 w-10 shrink-0 z-10 border-2 border-background shadow-sm">
                            {activity.avatarUrl && <AvatarImage src={activity.avatarUrl} loading="lazy" />}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{activity.type === "hire" ? "H" : activity.type === "review" ? "R" : "A"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 pt-1 min-w-0">
                            <p className="text-sm font-medium leading-tight text-foreground">{activity.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.subtitle}</p>
                            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
