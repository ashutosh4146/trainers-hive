import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetCurrentUser,
  useGetVendorStats,
  useGetTrainerStats,
  useGetPlatformStats,
  useListRequirements,
  useListMyApplications,
  useListActivity,
  useListRecentRequirements,
  useListFeaturedTrainers,
  useListHireInquiries,
  useUpdateHireInquiryStatus,
  useDeleteRequirement,
  useUnflagRequirement,
  useListSavedTrainers,
  useUnsaveTrainer,
  getListRequirementsQueryKey,
  getListSavedTrainersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import {
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Star,
  Eye,
  TrendingUp,
  FileText,
  Activity,
  Plus,
  ShieldCheck,
  Flag,
  Trash2,
  MessageSquare,
  Bookmark,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MessageThread } from "@/components/MessageThread";

type VerificationRequest = {
  id: string;
  trainerId: string;
  status: string;
  message: string | null;
  adminNote: string | null;
  createdAt: string;
  trainer: { id: string; name: string; avatarUrl: string; mainSkill: string } | null;
};

function VendorDashboard({ vendorId }: { vendorId: string }) {
  const { data: stats, isLoading: statsLoading } = useGetVendorStats();
  const { data: requirements, isLoading: reqsLoading } = useListRequirements({ vendorId });
  const { data: savedTrainers, isLoading: savedLoading } = useListSavedTrainers(vendorId, {
    query: { queryKey: getListSavedTrainersQueryKey(vendorId) },
  });
  const unsaveTrainer = useUnsaveTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUnsave = (trainerId: string, trainerName: string) => {
    unsaveTrainer.mutate(
      { id: vendorId, trainerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
          toast({ title: `Removed ${trainerName} from saved trainers` });
        },
        onError: () => toast({ title: "Error", description: "Could not remove bookmark.", variant: "destructive" }),
      },
    );
  };

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Requirements" value={stats?.totalRequirements || 0} icon={<FileText />} />
        <StatCard title="Open Requirements" value={stats?.openRequirements || 0} icon={<Briefcase />} />
        <StatCard title="Applications" value={stats?.applicationsReceived || 0} icon={<Users />} />
        <StatCard title="Shortlisted" value={stats?.shortlistedTrainers || 0} icon={<Star />} />
        <StatCard title="Hired" value={stats?.hiredTrainers || 0} icon={<CheckCircle />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Applications Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.applicationsTrend && stats.applicationsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.applicationsTrend}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM d')} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.skillBreakdown && stats.skillBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.skillBreakdown} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="skill" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Requirements</CardTitle>
          <Link href="/requirements/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Post New</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {reqsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : requirements && requirements.length > 0 ? (
            <div className="space-y-4">
              {requirements.map(req => (
                <Link key={req.id} href={`/requirements/${req.id}`} className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card hover:shadow-sm">
                  <div>
                    <h4 className="font-semibold">{req.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{req.skill}</Badge>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Due {format(new Date(req.deadline), 'MMM d')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{req.applicationCount} apps</p>
                      <Badge variant={req.status === 'open' ? 'default' : 'secondary'} className="mt-1 capitalize text-[10px] py-0">{req.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-medium text-lg">No requirements yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Post your first training requirement to find expert trainers.</p>
              <Link href="/requirements/new">
                <Button>Post Requirement</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Trainers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" /> Saved Trainers
            </CardTitle>
            <CardDescription>Trainers you've bookmarked for future engagements</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {savedTrainers?.length ?? 0} saved
          </Badge>
        </CardHeader>
        <CardContent>
          {savedLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !savedTrainers?.length ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No saved trainers yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Browse trainers and click "Save Trainer" to keep track of them here.</p>
              <Link href="/trainers"><Button variant="outline" size="sm">Browse Trainers</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {savedTrainers.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border gap-4 hover:border-primary/30 transition-colors">
                  <Link href={`/trainers/${s.trainer.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={s.trainer.avatarUrl}
                      alt={s.trainer.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.trainer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.trainer.mainSkill}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{s.trainer.rating.toFixed(1)}</span>
                        <span className="ml-2">{s.trainer.location}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/trainers/${s.trainer.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">View</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      disabled={unsaveTrainer.isPending}
                      onClick={() => handleUnsave(s.trainer.id, s.trainer.name)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrainerDashboard({ trainerId }: { trainerId: string }) {
  const { data: user } = useGetCurrentUser();
  const { data: stats, isLoading: statsLoading } = useGetTrainerStats();
  const { data: applications, isLoading: appsLoading } = useListMyApplications();
  const { data: matchingReqs, isLoading: matchLoading } = useListRequirements(
    { status: "open" },
    { query: { queryKey: [...getListRequirementsQueryKey({ status: "open" }), "trainer", trainerId] } },
  );
  const top5 = matchingReqs?.slice(0, 5) ?? [];
  const hasNoSkills = !user || (user as typeof user & { mainSkill?: string }).mainSkill === "";
  const [messageAppId, setMessageAppId] = useState<string | null>(null);
  const [messageAppTitle, setMessageAppTitle] = useState<string>("");
  const [, navigate] = useLocation();

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Applications" value={stats?.applicationsSent || 0} icon={<FileText />} />
        <StatCard title="Shortlisted" value={stats?.shortlisted || 0} icon={<Star />} />
        <StatCard title="Hired" value={stats?.hired || 0} icon={<CheckCircle />} />
        <StatCard title="Rating" value={stats?.averageRating?.toFixed(1) || "0.0"} icon={<Star className="text-amber-500 fill-amber-500" />} />
        <StatCard title="Reviews" value={stats?.totalReviews || 0} icon={<Users />} />
        <StatCard title="Profile Views" value={stats?.profileViews || 0} icon={<Eye />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Applications Sent</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.applicationsTrend && stats.applicationsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.applicationsTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM d')} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none">
          <CardHeader>
            <CardTitle className="text-primary-foreground">Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-primary-foreground/80">Keep your profile updated and apply to new opportunities to increase your chances of getting hired.</p>
            <Link href="/requirements">
              <Button className="w-full bg-white text-primary hover:bg-white/90">Browse Opportunities</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full border-primary-foreground/20 bg-transparent hover:bg-primary-foreground/10 text-primary-foreground">Update Profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Matching Requirements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Matching Requirements
            </CardTitle>
            <CardDescription>Open requirements that match your skills, ranked by relevance</CardDescription>
          </div>
          <Link href="/requirements">
            <Button variant="outline" size="sm" className="text-xs shrink-0">See all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {matchLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : top5.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              {hasNoSkills ? (
                <>
                  <p className="font-medium text-muted-foreground">No skills set yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Add your primary skill to your profile so we can surface the most relevant requirements for you.
                  </p>
                  <Link href="/profile"><Button variant="outline" size="sm">Complete your profile</Button></Link>
                </>
              ) : (
                <>
                  <p className="font-medium text-muted-foreground">No matching requirements right now</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Check back soon — new requirements are posted regularly. You can also browse all open requirements.
                  </p>
                  <Link href="/requirements"><Button variant="outline" size="sm">Browse all requirements</Button></Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {top5.map((req) => (
                <Link
                  key={req.id}
                  href={`/requirements/${req.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:shadow-sm transition-all bg-card gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{req.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{req.vendorName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-normal">
                      {req.skill}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      {format(new Date(req.deadline), "MMM d")}
                    </span>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">Apply</Button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : applications && applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map(app => {
                const canMessage = app.status === 'shortlisted' || app.status === 'hired';
                return (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card gap-4 hover:shadow-sm cursor-pointer"
                    onClick={() => navigate(`/requirements/${app.requirementId}`)}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 rounded-md border">
                        <AvatarImage src={app.requirement.vendorLogoUrl} />
                        <AvatarFallback className="rounded-md">V</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{app.requirement.title}</h4>
                        <p className="text-sm text-muted-foreground">{app.requirement.vendorName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Proposed: </span>
                        <span className="font-medium">${app.proposedRate}</span>
                      </div>
                      <Badge variant={app.status === 'hired' ? 'default' : app.status === 'shortlisted' ? 'secondary' : app.status === 'rejected' ? 'destructive' : 'outline'} className="capitalize w-24 justify-center">
                        {app.status}
                      </Badge>
                      {canMessage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageAppId(app.id);
                            setMessageAppTitle(app.requirement.title);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-medium text-lg">No applications yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Start applying to training requirements to see them here.</p>
              <Link href="/requirements">
                <Button>Browse Requirements</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {messageAppId && user?.id && (
        <MessageThread
          applicationId={messageAppId}
          currentUserId={user.id}
          open={!!messageAppId}
          onOpenChange={(open) => { if (!open) setMessageAppId(null); }}
          title={`Message — ${messageAppTitle}`}
        />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:         { label: "New",         className: "bg-blue-100 text-blue-700 border-blue-200" },
  contacted:   { label: "Contacted",   className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  in_progress: { label: "In Progress", className: "bg-purple-100 text-purple-700 border-purple-200" },
  closed:      { label: "Closed",      className: "bg-green-100 text-green-700 border-green-200" },
};

const STATUS_NEXT: Record<string, string> = {
  new: "contacted", contacted: "in_progress", in_progress: "closed", closed: "new",
};

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats();
  const { data: activity, isLoading: actLoading } = useListActivity();
  const { data: requirements, isLoading: reqsLoading } = useListRecentRequirements();
  const { data: trainers, isLoading: trainersLoading } = useListFeaturedTrainers();
  const { data: inquiries, isLoading: inqLoading, refetch: refetchInquiries } = useListHireInquiries();
  const { data: flaggedReqs, isLoading: flaggedLoading } = useListRequirements({ flagged: true } as any);
  const updateStatus = useUpdateHireInquiryStatus();
  const deleteRequirement = useDeleteRequirement();
  const unflagRequirement = useUnflagRequirement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [vreqLoading, setVreqLoading] = useState(true);

  const fetchVerificationRequests = async () => {
    setVreqLoading(true);
    try {
      const res = await fetch("/api/verification-requests");
      if (res.ok) setVerificationRequests(await res.json());
    } finally {
      setVreqLoading(false);
    }
  };

  useEffect(() => { fetchVerificationRequests(); }, []);

  const handleVerificationAction = async (id: string, status: "approved" | "rejected", adminNote?: string) => {
    const res = await fetch(`/api/verification-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote }),
    });
    if (res.ok) {
      toast({ title: status === "approved" ? "Trainer verified!" : "Request rejected", description: status === "approved" ? "The trainer now has a verified badge." : "The request has been declined." });
      fetchVerificationRequests();
    }
  };

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Trainers" value={stats?.trainerCount || 0} icon={<Users />} />
        <StatCard title="Total Vendors" value={stats?.vendorCount || 0} icon={<Building2 />} />
        <StatCard title="Open Requirements" value={stats?.openRequirementCount || 0} icon={<Briefcase />} />
        <StatCard title="Completed Engagements" value={stats?.completedEngagements || 0} icon={<CheckCircle />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Skill Demand</CardTitle>
            <CardDescription>Top skills currently requested in open requirements</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {stats?.skillBreakdown && stats.skillBreakdown.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats.skillBreakdown} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                   <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                   <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                   <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                   <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                 </BarChart>
               </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5"/> Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="px-6 space-y-6 max-h-[350px] overflow-y-auto">
              {actLoading ? <Skeleton className="h-[200px] w-full" /> : activity?.length ? (
                activity.map((item, i) => (
                  <div key={item.id} className="flex gap-4 relative">
                    {i !== activity.length - 1 && <div className="absolute left-[19px] top-10 bottom-[-24px] w-px bg-border" />}
                    <Avatar className="h-10 w-10 border-2 border-background z-10 shrink-0">
                      <AvatarImage src={item.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{item.type.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground text-sm">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            {reqsLoading ? <Skeleton className="h-[200px] w-full" /> : requirements?.length ? (
              <div className="space-y-4">
                {requirements.slice(0, 5).map(req => (
                  <Link key={req.id} href={`/requirements/${req.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{req.title}</p>
                      <p className="text-xs text-muted-foreground">{req.vendorName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                  </Link>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm">No requirements found</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Featured Trainers</CardTitle>
          </CardHeader>
          <CardContent>
            {trainersLoading ? <Skeleton className="h-[200px] w-full" /> : trainers?.length ? (
              <div className="space-y-4">
                {trainers.slice(0, 5).map(trainer => (
                  <Link key={trainer.id} href={`/trainers/${trainer.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={trainer.avatarUrl} />
                        <AvatarFallback>{trainer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{trainer.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{trainer.headline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-500">
                      <Star className="h-3 w-3 fill-amber-500"/> {trainer.rating.toFixed(1)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm">No trainers found</p>}
          </CardContent>
        </Card>
      </div>

      {/* Hire Us Inquiries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Hire Us Inquiries
            </CardTitle>
            <CardDescription>Companies that requested managed trainer sourcing</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">{inquiries?.length ?? 0} total</Badge>
        </CardHeader>
        <CardContent>
          {inqLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !inquiries?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No inquiries yet — share the Hire Us page!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-3 pr-4 font-medium">Company</th>
                    <th className="text-left pb-3 pr-4 font-medium">Contact</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">Requirement</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Budget / Timeline</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inquiries.map((inq) => {
                    const s = STATUS_LABELS[inq.status] ?? STATUS_LABELS.new;
                    return (
                      <tr key={inq.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{inq.companyName}</p>
                          {inq.location && <p className="text-xs text-muted-foreground">{inq.location}</p>}
                        </td>
                        <td className="py-3 pr-4">
                          <p>{inq.contactName}</p>
                          <p className="text-xs text-muted-foreground">{inq.email}</p>
                          {inq.phone && <p className="text-xs text-muted-foreground">{inq.phone}</p>}
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell max-w-[200px]">
                          <p className="truncate text-xs text-muted-foreground">{inq.trainingNeed}</p>
                          {inq.headcount && <p className="text-xs mt-0.5">{inq.headcount} people</p>}
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell text-xs">
                          {inq.budget && <p className="font-medium">{inq.budget}</p>}
                          {inq.timeline && <p className="text-muted-foreground">{inq.timeline}</p>}
                        </td>
                        <td className="py-3">
                          <button
                            title="Click to advance status"
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${s.className}`}
                            onClick={() =>
                              updateStatus.mutate(
                                { id: inq.id, data: { status: STATUS_NEXT[inq.status] as any } },
                                { onSuccess: () => refetchInquiries() }
                              )
                            }
                          >
                            {s.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagged Requirements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" /> Flagged Requirements
            </CardTitle>
            <CardDescription>Requirements reported by trainers as problematic</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
            {flaggedReqs?.length ?? 0} flagged
          </Badge>
        </CardHeader>
        <CardContent>
          {flaggedLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !flaggedReqs?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No flagged requirements — all clear!</p>
          ) : (
            <div className="space-y-3">
              {(flaggedReqs as any[]).map((req) => (
                <div key={req.id} className="flex items-start justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/requirements/${req.id}`} className="font-medium text-sm hover:underline truncate">
                        {req.title}
                      </Link>
                      <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.vendorName}</p>
                    {req.flagReason && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <Flag className="h-3 w-3 shrink-0" />
                        {req.flagReason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                      disabled={unflagRequirement.isPending}
                      onClick={async () => {
                        try {
                          await unflagRequirement.mutateAsync({ id: req.id });
                          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                          toast({ title: "Flag removed", description: `"${req.title}" has been unflagged.` });
                        } catch {
                          toast({ title: "Error", description: "Could not unflag.", variant: "destructive" });
                        }
                      }}
                    >
                      Unflag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={deleteRequirement.isPending}
                      onClick={async () => {
                        if (!confirm(`Remove "${req.title}"? This cannot be undone.`)) return;
                        try {
                          await deleteRequirement.mutateAsync({ id: req.id });
                          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                          toast({ title: "Requirement removed", description: `"${req.title}" has been deleted.` });
                        } catch {
                          toast({ title: "Error", description: "Could not remove.", variant: "destructive" });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Verification Requests
            </CardTitle>
            <CardDescription>Trainers applying for a verified badge</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {verificationRequests.filter(r => r.status === "pending").length} pending
          </Badge>
        </CardHeader>
        <CardContent>
          {vreqLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !verificationRequests.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No verification requests yet.</p>
          ) : (
            <div className="space-y-3">
              {verificationRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={req.trainer?.avatarUrl} />
                      <AvatarFallback>{req.trainer?.name?.charAt(0) ?? "T"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{req.trainer?.name ?? req.trainerId}</p>
                      <p className="text-xs text-muted-foreground truncate">{req.trainer?.mainSkill}</p>
                      {req.message && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">"{req.message}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.status === "pending" ? (
                      <>
                        <Button size="sm" variant="outline" className="text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleVerificationAction(req.id, "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-red-700 border-red-200 hover:bg-red-50" onClick={() => handleVerificationAction(req.id, "rejected")}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Badge variant={req.status === "approved" ? "secondary" : "outline"} className={req.status === "approved" ? "bg-green-100 text-green-800" : "text-red-600 border-red-200"}>
                        {req.status === "approved" ? "Approved" : "Rejected"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
}

// Quick helper for missing icon
function Building2(props: any) {
  return <Building {...props} />;
}
import { Building } from "lucide-react";

export default function Dashboard() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8"><DashboardSkeleton /></div>;
  }

  if (!user) {
    return <div className="container mx-auto px-4 py-8">Please log in to view the dashboard.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize">Welcome back to your {user.role} workspace.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {user.role === 'vendor' && user.vendorId && <VendorDashboard vendorId={user.vendorId} />}
        {user.role === 'trainer' && user.trainerId && <TrainerDashboard trainerId={user.trainerId} />}
        {user.role === 'admin' && <AdminDashboard />}
      </motion.div>
    </div>
  );
}
