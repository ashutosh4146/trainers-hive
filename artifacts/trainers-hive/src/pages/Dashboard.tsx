import React, { useEffect, useState } from "react";
import { Link } from "wouter";
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
} from "@workspace/api-client-react";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
    </div>
  );
}

function TrainerDashboard({ trainerId }: { trainerId: string }) {
  const { data: stats, isLoading: statsLoading } = useGetTrainerStats();
  const { data: applications, isLoading: appsLoading } = useListMyApplications();

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

      <Card>
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : applications && applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map(app => (
                <Link key={app.id} href={`/requirements/${app.requirementId}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card gap-4 hover:shadow-sm">
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
                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Proposed: </span>
                      <span className="font-medium">${app.proposedRate}</span>
                    </div>
                    <Badge variant={app.status === 'hired' ? 'default' : app.status === 'shortlisted' ? 'secondary' : app.status === 'rejected' ? 'destructive' : 'outline'} className="capitalize w-24 justify-center">
                      {app.status}
                    </Badge>
                  </div>
                </Link>
              ))}
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
  const updateStatus = useUpdateHireInquiryStatus();
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
