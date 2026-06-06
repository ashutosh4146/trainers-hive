import React from "react";
import { Link } from "wouter";
import {
  useGetCurrentUser,
  useGetTrainer,
  useGetTrainerStats,
  useListMyApplications,
  useListRequirements,
} from "@workspace/api-client-react";
import { TrainerApplicationsSection } from "@/components/TrainerApplicationsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { format } from "date-fns";

type RequirementLite = {
  id: string;
  title: string;
  vendorName: string;
  skill: string;
  deadline: string;
  status?: string;
};

function MiniStat({ title, value, icon, href }: { title: string; value: React.ReactNode; icon: React.ReactNode; href?: string }) {
  const content = (
    <Card className="border-primary/10 transition-colors hover:border-primary/30">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

function getProfileScore(trainer: any) {
  const checks = [
    trainer?.name,
    trainer?.headline,
    trainer?.mainSkill,
    trainer?.bio,
    trainer?.location,
    trainer?.trainerType,
    trainer?.experienceYears !== undefined && trainer?.experienceYears !== null,
    Array.isArray(trainer?.subSkills) && trainer.subSkills.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function statusTone(status: string) {
  if (status === "hired") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800";
  if (status === "shortlisted") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";
  if (status === "completed") return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800";
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800";
}

function ApplicationsFocusCard({ applications }: { applications: any[] }) {
  const actionable = applications.filter((app) => app.status === "shortlisted" || app.status === "hired");
  const latest = actionable[0] ?? applications[0];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5 text-primary" /> Action center
        </CardTitle>
        <CardDescription>Important follow-ups for your current applications.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Needs follow-up</p>
            <p className="mt-1 text-2xl font-bold text-primary">{actionable.length}</p>
          </div>
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Under review</p>
            <p className="mt-1 text-2xl font-bold">{applications.filter((app) => app.status === "submitted").length}</p>
          </div>
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-bold">{applications.filter((app) => app.status === "completed").length}</p>
          </div>
        </div>

        {latest ? (
          <div className="rounded-lg border bg-background/80 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{latest.requirement?.title}</p>
                  <Badge variant="outline" className={cn("capitalize", statusTone(latest.status))}>{latest.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{latest.requirement?.vendorName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {latest.status === "shortlisted" || latest.status === "hired"
                    ? "Respond quickly and align on scope, dates, commercials, and next steps."
                    : "Keep your profile updated while the vendor reviews your application."}
                </p>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link href={latest.status === "shortlisted" || latest.status === "hired" ? "/messages" : `/requirements/${latest.requirementId}`}>
                  {latest.status === "shortlisted" || latest.status === "hired" ? "Open messages" : "View application"}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
            No applications yet. Apply to relevant requirements to start tracking progress here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchingRequirements({ requirements, trainerSkill, loading }: { requirements: RequirementLite[]; trainerSkill?: string; loading: boolean }) {
  const skill = trainerSkill?.trim().toLowerCase();
  const sorted = [...requirements]
    .sort((a, b) => {
      const aMatch = skill && a.skill?.toLowerCase() === skill ? 1 : 0;
      const bMatch = skill && b.skill?.toLowerCase() === skill ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Matching requirements
          </CardTitle>
          <CardDescription>Open opportunities sorted by relevance to your profile.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/requirements">Browse all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No open requirements right now.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((req) => {
              const isSkillMatch = skill && req.skill?.toLowerCase() === skill;
              return (
                <Link key={req.id} href={`/requirements/${req.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-primary/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{req.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{req.vendorName}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline" className={cn("text-xs", isSkillMatch ? "border-primary/30 bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{req.skill}{isSkillMatch ? " · You" : ""}</Badge>
                    {req.deadline && <span className="hidden text-xs text-muted-foreground sm:inline">Due {format(new Date(req.deadline), "MMM d")}</span>}
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillsDemand({ requirements, trainerSkill }: { requirements: RequirementLite[]; trainerSkill?: string }) {
  const counts = requirements.reduce<Record<string, number>>((acc, req) => {
    if (!req.skill) return acc;
    acc[req.skill] = (acc[req.skill] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  const mainSkill = trainerSkill?.trim().toLowerCase();

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Skills in demand
          </CardTitle>
          <CardDescription>Current demand across open requirements.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/requirements">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No demand data available yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.map(([skill, count]) => {
              const isMine = mainSkill && skill.toLowerCase() === mainSkill;
              return (
                <div key={skill} className="grid grid-cols-[170px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                  <div className={cn("font-medium", isMine && "text-primary")}>{skill} {isMine && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px]">You</span>}</div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(12, (count / max) * 100)}%` }} />
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{count} req</div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrainerDashboardRedesign() {
  const { data: user } = useGetCurrentUser();
  const trainerId = user?.trainerId ?? "";
  const { data: stats, isLoading: statsLoading } = useGetTrainerStats();
  const { data: applications, isLoading: appsLoading } = useListMyApplications();
  const { data: trainer, isLoading: trainerLoading } = useGetTrainer(trainerId, { query: { enabled: !!trainerId } });
  const { data: openRequirements, isLoading: requirementsLoading } = useListRequirements({ status: "open" });

  const apps = applications ?? [];
  const requirements = (openRequirements ?? []) as RequirementLite[];
  const profileScore = trainer ? getProfileScore(trainer) : 0;

  if (statsLoading || trainerLoading) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Trainer dashboard</h1>
              {trainer?.verified && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><BadgeCheck className="mr-1 h-3.5 w-3.5" /> Verified</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Focus on relevant opportunities, active follow-ups, and profile readiness.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/requirements"><Search className="mr-2 h-4 w-4" /> Browse opportunities</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile"><UserRound className="mr-2 h-4 w-4" /> Update profile</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniStat title="Applications" value={stats?.applicationsSent || 0} icon={<FileText className="h-5 w-5" />} href="#trainer-applications-enhanced" />
        <MiniStat title="Shortlisted" value={stats?.shortlisted || 0} icon={<Star className="h-5 w-5" />} href="#trainer-applications-enhanced" />
        <MiniStat title="Hired" value={stats?.hired || 0} icon={<CheckCircle className="h-5 w-5" />} href="#trainer-applications-enhanced" />
        <MiniStat title="Rating" value={stats?.averageRating?.toFixed(1) || "0.0"} icon={<Star className="h-5 w-5 fill-amber-500 text-amber-500" />} />
        <MiniStat title="Reviews" value={stats?.totalReviews || 0} icon={<Briefcase className="h-5 w-5" />} />
        <MiniStat title="Profile views" value={stats?.profileViews || 0} icon={<Eye className="h-5 w-5" />} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ApplicationsFocusCard applications={apps} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile readiness</CardTitle>
            <CardDescription>Better profile quality improves trust and response rate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-primary">{profileScore}%</span>
                <span className="text-xs text-muted-foreground">Completion</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${profileScore}%` }} />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {profileScore >= 90 ? "Your profile looks strong. Keep availability and portfolio details updated." : "Add headline, bio, location, skills, and experience details to improve matching."}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/profile">Improve profile</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <MatchingRequirements requirements={requirements} trainerSkill={trainer?.mainSkill} loading={requirementsLoading} />
      <SkillsDemand requirements={requirements} trainerSkill={trainer?.mainSkill} />
      <TrainerApplicationsSection />
    </div>
  );
}
