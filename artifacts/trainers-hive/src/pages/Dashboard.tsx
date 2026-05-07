import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetCurrentUser,
  useGetVendor,
  useGetVendorStats,
  useGetTrainerStats,
  useGetPlatformStats,
  useListRequirements,
  useListMyApplications,
  useListRecentRequirements,
  useListFeaturedTrainers,
  useListHireInquiries,
  useUpdateHireInquiryStatus,
  useDeleteRequirement,
  useUnflagRequirement,
  useGetVendorHiringStats,
  useListSavedTrainers,
  useUnsaveTrainer,
  useListVendorEndorsements,
  useUpdateTrainerEndorsement,
  useDeleteTrainerEndorsement,
  getListVendorEndorsementsQueryKey,
  useGetTrainer,
  useListAdminUsers,
  useDeactivateUser,
  useReactivateUser,
  useChangeUserRole,
  useWithdrawApplication,
  useListAdminVendors,
  useVerifyVendor,
  useListHireThroughUsRequirements,
  useGetSkillsDemand,
  getListRequirementsQueryKey,
  getListSavedTrainersQueryKey,
  getGetTrainerQueryKey,
  getListAdminUsersQueryKey,
  getListAdminVendorsQueryKey,
  getListMyApplicationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ClipboardList,
  Plus,
  ShieldCheck,
  Flag,
  Trash2,
  MessageSquare,
  Bookmark,
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  Download,
  LogOut,
  ThumbsUp,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MessageThread } from "@/components/MessageThread";

type VerificationRequest = {
  id: string;
  trainerId: string;
  status: string;
  message: string | null;
  adminNote: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  qualification: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  trainer: { id: string; name: string; avatarUrl: string; mainSkill: string } | null;
};

function VendorDashboard({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useGetVendor(vendorId);
  const { data: stats, isLoading: statsLoading } = useGetVendorStats();
  const { data: hiringStats, isLoading: hiringLoading } = useGetVendorHiringStats(vendorId);
  const { data: requirements, isLoading: reqsLoading } = useListRequirements({ vendorId });
  const { data: savedTrainers, isLoading: savedLoading } = useListSavedTrainers(vendorId, {
    query: { queryKey: getListSavedTrainersQueryKey(vendorId) },
  });
  const { data: givenEndorsements, isLoading: endorsementsLoading } = useListVendorEndorsements(vendorId, {
    query: { queryKey: getListVendorEndorsementsQueryKey(vendorId) },
  });
  const unsaveTrainer = useUnsaveTrainer();
  const updateEndorsement = useUpdateTrainerEndorsement();
  const deleteEndorsement = useDeleteTrainerEndorsement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingEndorsement, setEditingEndorsement] = useState<{ id: string; trainerId: string; text: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingEndorsementId, setDeletingEndorsementId] = useState<string | null>(null);

  const handleSaveEditEndorsement = () => {
    if (!editingEndorsement) return;
    updateEndorsement.mutate(
      { id: editingEndorsement.trainerId, endorsementId: editingEndorsement.id, data: { text: editText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVendorEndorsementsQueryKey(vendorId) });
          setEditingEndorsement(null);
          toast({ title: "Endorsement updated" });
        },
        onError: () => toast({ title: "Error", description: "Could not update endorsement.", variant: "destructive" }),
      },
    );
  };

  const handleDeleteEndorsement = (endorsementId: string, trainerId: string) => {
    deleteEndorsement.mutate(
      { id: trainerId, endorsementId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVendorEndorsementsQueryKey(vendorId) });
          setDeletingEndorsementId(null);
          toast({ title: "Endorsement removed" });
        },
        onError: () => toast({ title: "Error", description: "Could not remove endorsement.", variant: "destructive" }),
      },
    );
  };

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
        <StatCard title="Total Requirements" value={stats?.totalRequirements || 0} icon={<FileText />} href="#your-requirements" />
        <StatCard title="Open Requirements" value={stats?.openRequirements || 0} icon={<Briefcase />} href="#your-requirements" />
        <StatCard title="Applications" value={stats?.applicationsReceived || 0} icon={<Users />} href="#your-requirements" />
        <StatCard title="Shortlisted" value={stats?.shortlistedTrainers || 0} icon={<Star />} href="#your-requirements" />
        <StatCard title="Hired" value={stats?.hiredTrainers || 0} icon={<CheckCircle />} href="#your-requirements" />
      </div>

      {vendor?.verified && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 w-fit">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-sm leading-tight">Verified by Trainers Hive</p>
            <p className="text-xs text-blue-600 leading-tight mt-0.5">Your company profile has been verified.</p>
          </div>
        </div>
      )}

      {/* Time-to-hire stat card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Avg. Time to Hire</CardTitle>
        </CardHeader>
        <CardContent>
          {hiringLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : !hiringStats || hiringStats.hiredCount === 0 ? (
            <div className="text-muted-foreground text-sm py-1">
              <p className="text-lg font-semibold text-foreground mb-0.5">No hires yet</p>
              <p>Time-to-hire will appear here once you mark an applicant as hired.</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-primary">
                {hiringStats.avgDays} <span className="text-base font-normal text-muted-foreground">days avg.</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hiringStats.hiredCount} {hiringStats.hiredCount === 1 ? "requirement" : "requirements"} hired
                {hiringStats.minDays !== null && hiringStats.maxDays !== null && (
                  <> · fastest {hiringStats.minDays}d · slowest {hiringStats.maxDays}d</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card id="your-requirements">
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

      {/* Endorsements Given */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-primary" /> Endorsements Given
            </CardTitle>
            <CardDescription>Endorsements you've written for trainers you've worked with</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {givenEndorsements?.length ?? 0} given
          </Badge>
        </CardHeader>
        <CardContent>
          {endorsementsLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !givenEndorsements?.length ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <ThumbsUp className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No endorsements yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">After completing a training engagement, you can endorse that trainer from their profile.</p>
              <Link href="/trainers"><Button variant="outline" size="sm">Browse Trainers</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {givenEndorsements.map((e) => (
                <div key={e.id} className="flex items-start justify-between p-3 rounded-lg border gap-4 hover:border-primary/30 transition-colors">
                  <Link href={`/trainers/${e.trainerId}`} className="flex items-start gap-3 min-w-0 flex-1">
                    <img
                      src={e.trainerAvatarUrl}
                      alt={e.trainerName}
                      className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{e.trainerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(e.createdAt), 'MMM yyyy')}</p>
                      <p className="text-sm text-muted-foreground mt-1 italic line-clamp-2">"{e.text}"</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => {
                        setEditingEndorsement({ id: e.id, trainerId: e.trainerId, text: e.text });
                        setEditText(e.text);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingEndorsementId(e.id)}
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

      {/* Edit endorsement dialog */}
      <Dialog open={!!editingEndorsement} onOpenChange={(open) => { if (!open) setEditingEndorsement(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Endorsement</DialogTitle>
            <DialogDescription>Update your endorsement for {editingEndorsement ? givenEndorsements?.find((e) => e.id === editingEndorsement.id)?.trainerName : ""}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editText}
              onChange={(ev) => setEditText(ev.target.value)}
              maxLength={300}
              rows={4}
              placeholder="Describe your experience working with this trainer…"
            />
            <p className="text-xs text-muted-foreground text-right">{editText.length}/300</p>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditingEndorsement(null)}>Cancel</Button>
            <Button
              onClick={handleSaveEditEndorsement}
              disabled={updateEndorsement.isPending || editText.trim().length === 0}
            >
              {updateEndorsement.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete endorsement confirmation */}
      <AlertDialog open={!!deletingEndorsementId} onOpenChange={(open) => { if (!open) setDeletingEndorsementId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove endorsement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete your endorsement. The trainer will no longer see it on their profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const end = givenEndorsements?.find((e) => e.id === deletingEndorsementId);
                if (end) handleDeleteEndorsement(end.id, end.trainerId);
              }}
              disabled={deleteEndorsement.isPending}
            >
              {deleteEndorsement.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TrainerDashboard({ trainerId }: { trainerId: string }) {
  const { data: user } = useGetCurrentUser();
  const { data: stats, isLoading: statsLoading } = useGetTrainerStats();
  const { data: applications, isLoading: appsLoading } = useListMyApplications();
  const { data: trainerProfile, isLoading: profileLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const { data: matchingReqs, isLoading: matchLoading } = useListRequirements(
    { status: "open" },
    { query: { queryKey: [...getListRequirementsQueryKey({ status: "open" }), "trainer", trainerId] } },
  );
  const top5 = matchingReqs?.slice(0, 5) ?? [];
  const hasNoSkills = !!trainerProfile && !trainerProfile.mainSkill;
  const [messageAppId, setMessageAppId] = useState<string | null>(null);
  const [messageAppTitle, setMessageAppTitle] = useState<string>("");
  const [withdrawAppId, setWithdrawAppId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState<string>("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const withdrawMutation = useWithdrawApplication();

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Applications" value={stats?.applicationsSent || 0} icon={<FileText />} href="#your-applications" />
        <StatCard title="Shortlisted" value={stats?.shortlisted || 0} icon={<Star />} href="#your-applications" />
        <StatCard title="Hired" value={stats?.hired || 0} icon={<CheckCircle />} href="#your-applications" />
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Matching Requirements
          </CardTitle>
          <CardDescription>Open requirements that match your skills, ranked by relevance</CardDescription>
        </CardHeader>
        <CardContent>
          {matchLoading || profileLoading ? (
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
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all bg-card gap-3"
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
                    <span className="text-xs font-medium text-primary whitespace-nowrap">
                      Apply →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills in Demand */}
      <SkillsInDemandCard mainSkill={trainerProfile?.mainSkill} />

      <Card id="your-applications">
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
                const canWithdraw = app.status !== 'rejected' && app.status !== 'withdrawn';
                const isWithdrawn = app.status === 'withdrawn';
                return (
                  <div
                    key={app.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-colors bg-card gap-4 cursor-pointer ${isWithdrawn ? 'opacity-60 hover:border-border' : 'hover:border-primary/50 hover:shadow-sm'}`}
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
                        {isWithdrawn && (app as any).withdrawnReason && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{(app as any).withdrawnReason}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                      {app.proposedRate != null && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Proposed: </span>
                          <span className="font-medium">₹{app.proposedRate}</span>
                        </div>
                      )}
                      <Badge
                        variant={
                          app.status === 'hired' ? 'default'
                          : app.status === 'shortlisted' ? 'secondary'
                          : app.status === 'rejected' || app.status === 'withdrawn' ? 'destructive'
                          : 'outline'
                        }
                        className="capitalize w-24 justify-center"
                      >
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
                      {canWithdraw && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWithdrawAppId(app.id);
                            setWithdrawReason("");
                          }}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Withdraw
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

      {/* Withdraw confirmation dialog */}
      <Dialog open={!!withdrawAppId} onOpenChange={(open) => { if (!open) setWithdrawAppId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>
              This will notify the vendor. If you were already hired, they will be alerted immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="withdraw-reason">Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea
              id="withdraw-reason"
              placeholder="e.g. Schedule conflict, personal reasons…"
              rows={3}
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setWithdrawAppId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={withdrawMutation.isPending}
              onClick={() => {
                if (!withdrawAppId) return;
                withdrawMutation.mutate(
                  { id: withdrawAppId, data: { reason: withdrawReason.trim() || undefined } },
                  {
                    onSuccess: () => {
                      setWithdrawAppId(null);
                      queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
                    },
                    onError: () => {
                      setWithdrawAppId(null);
                    },
                  }
                );
              }}
            >
              {withdrawMutation.isPending ? "Withdrawing…" : "Yes, withdraw"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  deactivatedAt?: string;
};

type ConfirmAction =
  | { type: "deactivate"; user: AdminUser }
  | { type: "reactivate"; user: AdminUser }
  | { type: "role"; user: AdminUser; newRole: "trainer" | "vendor" };

function AdminUsersSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const params = {
    q: q || undefined,
    role: (roleFilter !== "all" ? roleFilter : undefined) as "trainer" | "vendor" | "admin" | undefined,
    status: (statusFilter !== "all" ? statusFilter : undefined) as "active" | "deactivated" | undefined,
    page,
    pageSize: 20,
  };

  const { data, isLoading, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });

  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const changeRole = useChangeUserRole();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === "deactivate") {
        await deactivate.mutateAsync({ id: confirm.user.id });
        toast({ title: "Account deactivated", description: `${confirm.user.name} can no longer sign in.` });
      } else if (confirm.type === "reactivate") {
        await reactivate.mutateAsync({ id: confirm.user.id });
        toast({ title: "Account reactivated", description: `${confirm.user.name}'s account is now active.` });
      } else if (confirm.type === "role") {
        await changeRole.mutateAsync({ id: confirm.user.id, data: { role: confirm.newRole } });
        toast({ title: "Role updated", description: `${confirm.user.name} is now a ${confirm.newRole}.` });
      }
      invalidate();
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setConfirm(null);
    }
  };

  const users: AdminUser[] = (data?.users as AdminUser[] | undefined) ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 border-purple-200",
    vendor: "bg-blue-100 text-blue-800 border-blue-200",
    trainer: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> User Management
            </CardTitle>
            <CardDescription>Manage all platform user accounts</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">{total} total</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No users found matching your filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const isDeactivated = !!u.deactivatedAt;
                    return (
                      <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${isDeactivated ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[160px]">{u.name}</div>
                          <div className="text-xs text-muted-foreground md:hidden truncate">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isDeactivated ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                              <UserX className="h-3 w-3" /> Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                              <UserCheck className="h-3 w-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {u.role !== "admin" && (
                              <>
                                {isDeactivated ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-green-700 border-green-200 hover:bg-green-50 gap-1"
                                    onClick={() => setConfirm({ type: "reactivate", user: u })}
                                  >
                                    <UserCheck className="h-3 w-3" /> Reactivate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                                    onClick={() => setConfirm({ type: "deactivate", user: u })}
                                  >
                                    <UserX className="h-3 w-3" /> Deactivate
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs text-muted-foreground"
                                  onClick={() =>
                                    setConfirm({
                                      type: "role",
                                      user: u,
                                      newRole: u.role === "trainer" ? "vendor" : "trainer",
                                    })
                                  }
                                >
                                  → {u.role === "trainer" ? "Vendor" : "Trainer"}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>Page {page} of {totalPages} ({total} users)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "deactivate" && "Deactivate account?"}
              {confirm?.type === "reactivate" && "Reactivate account?"}
              {confirm?.type === "role" && "Change role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "deactivate" &&
                `${confirm.user.name} (${confirm.user.email}) will no longer be able to sign in. You can reactivate at any time.`}
              {confirm?.type === "reactivate" &&
                `${confirm.user.name} (${confirm.user.email}) will regain full access to the platform.`}
              {confirm?.type === "role" &&
                `${confirm.user.name} will be changed from ${confirm.user.role} to ${confirm.newRole}. This affects what they can see and do in the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirm?.type === "deactivate" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirm?.type === "deactivate" && "Deactivate"}
              {confirm?.type === "reactivate" && "Reactivate"}
              {confirm?.type === "role" && `Change to ${confirm?.newRole}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AdminVendorsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = { q: q || undefined, page, pageSize: 20 };

  const { data, isLoading, refetch } = useListAdminVendors(params, {
    query: { queryKey: getListAdminVendorsQueryKey(params) },
  });

  const verifyVendor = useVerifyVendor();

  const handleToggleVerify = async (id: string, currentlyVerified: boolean, name: string) => {
    try {
      await verifyVendor.mutateAsync({ id, data: { verified: !currentlyVerified } });
      queryClient.invalidateQueries({ queryKey: getListAdminVendorsQueryKey() });
      toast({
        title: currentlyVerified ? "Verification removed" : "Vendor verified",
        description: `${name} has been ${currentlyVerified ? "unverified" : "verified"}.`,
      });
    } catch {
      toast({ title: "Error", description: "Could not update verification.", variant: "destructive" });
    }
  };

  const vendors = data?.vendors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Vendor Verification
          </CardTitle>
          <CardDescription>Grant or revoke the verified badge for vendor companies</CardDescription>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">{total} total</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company or email..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : vendors.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No vendors found.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Industry</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 font-medium">Verified</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[180px]">{v.companyName}</div>
                      <div className="text-xs text-muted-foreground truncate">{v.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{v.industry}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{v.location}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{format(new Date(v.createdAt), "MMM d, yyyy")}</span>
                    </td>
                    <td className="px-4 py-3">
                      {v.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className={`text-xs gap-1 ${v.verified ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "text-primary border-primary/30 hover:bg-primary/10"}`}
                        disabled={verifyVendor.isPending}
                        onClick={() => handleToggleVerify(v.id, v.verified, v.companyName)}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {v.verified ? "Remove" : "Verify"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>Page {page} of {totalPages} ({total} vendors)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats();
  const { data: requirements, isLoading: reqsLoading } = useListRecentRequirements();
  const { data: trainers, isLoading: trainersLoading } = useListFeaturedTrainers();
  const { data: inquiries, isLoading: inqLoading, refetch: refetchInquiries } = useListHireInquiries();
  const { data: hireThroughUsReqs, isLoading: hireThroughUsLoading } = useListHireThroughUsRequirements();
  const { data: flaggedReqs, isLoading: flaggedLoading } = useListRequirements({ flagged: true } as any);
  const updateStatus = useUpdateHireInquiryStatus();
  const deleteRequirement = useDeleteRequirement();
  const unflagRequirement = useUnflagRequirement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [vreqLoading, setVreqLoading] = useState(true);

  type AnalyticsTrend = { week: string; count: number }[];
  const [analytics, setAnalytics] = useState<{
    trainerSignupsTrend: AnalyticsTrend;
    applicationsTrend: AnalyticsTrend;
    requirementsTrend: AnalyticsTrend;
  } | null>(null);

  const fetchVerificationRequests = async () => {
    setVreqLoading(true);
    try {
      const res = await fetch("/api/verification-requests");
      if (res.ok) setVerificationRequests(await res.json());
    } finally {
      setVreqLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationRequests();
    fetch("/api/admin/analytics")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalytics(data); })
      .catch(() => {});
  }, []);

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
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Action Items
            </CardTitle>
            <CardDescription>Things that need your attention right now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
                label: "Pending verifications",
                count: vreqLoading ? null : verificationRequests.filter(r => r.status === "pending").length,
                target: "verification-requests",
              },
              {
                icon: <Flag className="h-4 w-4 text-destructive" />,
                label: "Flagged requirements",
                count: flaggedLoading ? null : (flaggedReqs?.length ?? 0),
                target: "flagged-requirements",
              },
              {
                icon: <Briefcase className="h-4 w-4 text-amber-500" />,
                label: "New hire inquiries",
                count: inqLoading ? null : (inquiries?.filter(i => i.status === "new").length ?? 0),
                target: "hire-inquiries",
              },
              {
                icon: <Eye className="h-4 w-4 text-violet-500" />,
                label: "Hire Through Us requests",
                count: hireThroughUsLoading ? null : (hireThroughUsReqs?.length ?? 0),
                target: "hire-through-us",
              },
            ].map(item => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:border-primary/40 hover:bg-muted/40 transition-all text-left group"
                onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.count === null ? (
                  <Skeleton className="h-5 w-6 rounded-full" />
                ) : (
                  <Badge variant={item.count > 0 ? "default" : "secondary"} className="text-xs min-w-[1.5rem] justify-center">
                    {item.count}
                  </Badge>
                )}
              </button>
            ))}
            {!vreqLoading && !flaggedLoading && !inqLoading && !hireThroughUsLoading &&
              verificationRequests.filter(r => r.status === "pending").length === 0 &&
              !flaggedReqs?.length &&
              !inquiries?.filter(i => i.status === "new").length &&
              !hireThroughUsReqs?.length && (
              <p className="text-center text-xs text-muted-foreground pt-3 pb-1 flex items-center justify-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" /> All clear — nothing urgent right now
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Requirements</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = "/api/admin/export/requirements";
              }}
              data-testid="button-export-requirements-csv"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
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
                      <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} className="h-8 w-8" />
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

      {/* Growth Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Trainer Sign-ups
              </CardTitle>
              <CardDescription>Weekly new trainer registrations (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trainerSignupsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Applications
              </CardTitle>
              <CardDescription>Weekly applications received (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.applicationsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(180 60% 35%)" fill="hsl(180 60% 35% / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-primary" /> Requirements Posted
              </CardTitle>
              <CardDescription>Weekly new requirements (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.requirementsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(142 60% 35%)" fill="hsl(142 60% 35% / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hire Us Inquiries */}
      <Card id="hire-inquiries">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Hire Us Inquiries
            </CardTitle>
            <CardDescription>Companies that requested managed trainer sourcing</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{inquiries?.length ?? 0} total</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = "/api/admin/export/applications";
              }}
              data-testid="button-export-applications-csv"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
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

      {/* Hire Through Us Requirements */}
      <Card id="hire-through-us">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Hire Through Us Requirements
            </CardTitle>
            <CardDescription>Requirements submitted with managed-sourcing request — not visible publicly</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">{hireThroughUsReqs?.length ?? 0} total</Badge>
        </CardHeader>
        <CardContent>
          {hireThroughUsLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !hireThroughUsReqs?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hire-through-us requirements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-3 pr-4 font-medium">Title</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">Organisation</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Skill</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Location</th>
                    <th className="text-left pb-3 font-medium">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(hireThroughUsReqs as any[]).map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/requirements/${req.id}`} className="font-medium hover:underline line-clamp-1">
                          {req.title}
                        </Link>
                        {req.isUrgent && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            Urgent
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground">{req.vendorName}</td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {req.location ?? (req.remote ? "Remote" : "—")}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagged Requirements */}
      <Card id="flagged-requirements">
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

      {/* User Management */}
      <AdminUsersSection />

      {/* Vendor Verification */}
      <AdminVendorsSection />

      {/* Verification Requests */}
      <Card id="verification-requests">
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
                <div key={req.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrainerAvatar name={req.trainer?.name ?? "Trainer"} avatarUrl={req.trainer?.avatarUrl} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{req.trainer?.name ?? req.trainerId}</p>
                        <p className="text-xs text-muted-foreground truncate">{req.trainer?.mainSkill}</p>
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
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t pt-3">
                    {req.aadhaarNumber && (
                      <div><span className="text-muted-foreground">Aadhaar: </span><span className="font-mono">{req.aadhaarNumber}</span></div>
                    )}
                    {req.panNumber && (
                      <div><span className="text-muted-foreground">PAN: </span><span className="font-mono">{req.panNumber}</span></div>
                    )}
                    {req.dateOfBirth && (
                      <div><span className="text-muted-foreground">Date of Birth: </span>{req.dateOfBirth}</div>
                    )}
                    {req.qualification && (
                      <div className="col-span-2"><span className="text-muted-foreground">Qualification: </span>{req.qualification}</div>
                    )}
                    {req.message && (
                      <div className="col-span-2"><span className="text-muted-foreground">Note: </span><span className="italic">"{req.message}"</span></div>
                    )}
                    {!req.aadhaarNumber && !req.panNumber && !req.dateOfBirth && !req.qualification && !req.message && (
                      <div className="col-span-2 text-muted-foreground italic">No verification details provided.</div>
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

function SkillsInDemandCard({ mainSkill }: { mainSkill?: string | null }) {
  const { data: skillDemand, isLoading } = useGetSkillsDemand();
  const top10 = skillDemand?.slice(0, 10) ?? [];
  const maxCount = top10.length > 0 ? top10[0]!.count : 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" /> Skills in Demand
          </CardTitle>
          <CardDescription className="mt-0.5">Top skills in open requirements right now</CardDescription>
        </div>
        <Link href="/skills-demand">
          <Button variant="outline" size="sm" className="text-xs shrink-0">View all</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 shrink-0" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-4 w-8 shrink-0" />
              </div>
            ))}
          </div>
        ) : top10.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No open requirements yet.</p>
        ) : (
          <div className="space-y-2.5">
            {top10.map((item) => {
              const isMySkill = !!(mainSkill && item.skill.toLowerCase() === mainSkill.toLowerCase());
              const widthPct = Math.max(4, Math.round((item.count / maxCount) * 100));
              return (
                <div key={item.skill} className="flex items-center gap-3">
                  <div
                    className={`w-32 text-sm truncate shrink-0 font-medium ${isMySkill ? "text-primary" : "text-foreground"}`}
                    title={item.skill}
                  >
                    {item.skill}
                    {isMySkill && (
                      <Badge className="ml-1.5 text-[9px] py-0 px-1 h-4 leading-none align-middle">You</Badge>
                    )}
                  </div>
                  <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${isMySkill ? "bg-primary" : "bg-primary/25"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="w-16 text-right shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    <span className={`font-semibold ${isMySkill ? "text-primary" : "text-foreground"}`}>{item.count}</span>{" "}
                    {item.count === 1 ? "req" : "reqs"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon, href }: { title: string; value: string | number; icon: React.ReactNode; href?: string }) {
  const handleClick = () => {
    if (!href) return;
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const inner = (
    <Card className={href ? "hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer" : ""}>
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

  if (!href) return inner;
  if (href.startsWith("#")) return <div onClick={handleClick} className="cursor-pointer">{inner}</div>;
  return <Link href={href}>{inner}</Link>;
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
