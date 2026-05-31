import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequirement,
  useListRequirementApplications,
  useGetCurrentUser,
  useGetTrainer,
  useApplyToRequirement,
  useUpdateApplicationStatus,
  useUpdateRequirement,
  useDeleteRequirement,
  useFlagRequirement,
  useUnflagRequirement,
  useListMyApplications,
  useGetSuggestedTrainers,
  useGetRequirementAiMatches,
  useCreateTrainerReview,
  useWithdrawApplication,
  useBulkRejectRequirementApplications,
  useUpdateApplicationNote,
  useCompleteApplication,
  getListMyApplicationsQueryKey,
  getGetRequirementQueryKey,
  getGetTrainerQueryKey,
  getListRequirementApplicationsQueryKey,
  getListRequirementsQueryKey,
  getGetSuggestedTrainersQueryKey,
  getGetRequirementAiMatchesQueryKey,
  getListTrainerReviewsQueryKey,
} from "@workspace/api-client-react";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { MessageThread } from "@/components/MessageThread";
import AgreementSection from "@/components/agreements/AgreementSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building, MapPin, Briefcase, BookOpen, Clock, Users, CheckCircle2, XCircle, ArrowRight, CalendarX, Flag, AlertTriangle, MessageSquare, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, LogOut, RotateCcw, StickyNote, ShieldCheck, Zap, Lock, Handshake, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";

type EngagedRange = { startDate: string; endDate: string; note?: string };

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function findScheduleConflict(
  requirementStart: string | null | undefined,
  durationDays: number,
  engagedDates: EngagedRange[] | undefined,
): EngagedRange | null {
  if (!requirementStart || !engagedDates || engagedDates.length === 0) return null;
  const reqStart = requirementStart.slice(0, 10);
  const reqEnd = addDaysIso(reqStart, Math.max(0, (durationDays ?? 1) - 1));
  for (const r of engagedDates) {
    if (!r?.startDate || !r?.endDate) continue;
    const s = r.startDate.slice(0, 10);
    const e = r.endDate.slice(0, 10);
    if (rangesOverlap(reqStart, reqEnd, s, e)) return r;
  }
  return null;
}

export default function RequirementDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useGetCurrentUser();
  const { data: requirement, isLoading: reqLoading } = useGetRequirement(id, {
    query: { enabled: !!id, queryKey: getGetRequirementQueryKey(id) },
  });

  const isVendorOwner = user?.role === "vendor" && requirement?.vendorId === user.vendorId;
  const isAdmin = user?.role === "admin";
  const deleteRequirement = useDeleteRequirement();
  const [, navigate] = useLocation();

  const { data: applications, isLoading: appsLoading } = useListRequirementApplications(id, {
    query: { enabled: !!id && isVendorOwner, queryKey: getListRequirementApplicationsQueryKey(id) },
  });

  const trainerId = user?.role === "trainer" ? user.trainerId : undefined;
  const { data: currentTrainer, isLoading: trainerLoading } = useGetTrainer(trainerId ?? "", {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId ?? "") },
  });
  const { data: myApplications } = useListMyApplications({
    query: { enabled: !!trainerId, queryKey: getListMyApplicationsQueryKey() },
  });
  const myApplication = myApplications?.find((a) => a.requirementId === id);

  const isVendorOrAdmin = user?.role === "vendor" || user?.role === "admin";
  const { data: suggestedTrainers, isLoading: suggestedLoading } = useGetSuggestedTrainers(id, {
    query: { enabled: !!id && isVendorOrAdmin, queryKey: getGetSuggestedTrainersQueryKey(id) },
  });

  const { data: aiMatches, isLoading: aiMatchesLoading, error: aiMatchesError } = useGetRequirementAiMatches(id, {
    query: { enabled: !!id && isVendorOwner, queryKey: getGetRequirementAiMatchesQueryKey(id) },
  });

  const applyMutation = useApplyToRequirement();
  const updateAppMutation = useUpdateApplicationStatus();
  const updateReqMutation = useUpdateRequirement();
  const flagMutation = useFlagRequirement();
  const unflagMutation = useUnflagRequirement();
  const createReview = useCreateTrainerReview();
  const withdrawMutation = useWithdrawApplication();
  const bulkRejectMutation = useBulkRejectRequirementApplications();
  const updateNoteMutation = useUpdateApplicationNote();
  const completeMutation = useCompleteApplication();

  const [message, setMessage] = useState("");
  const [proposedRate, setProposedRate] = useState<string>("");
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isFlagOpen, setIsFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [customFlagReason, setCustomFlagReason] = useState("");
  const [messageAppId, setMessageAppId] = useState<string | null>(null);
  const [messageAppName, setMessageAppName] = useState<string>("");
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);
  const [noteAppId, setNoteAppId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [completingAppId, setCompletingAppId] = useState<string | null>(null);
  const [justCompletedTrainerId, setJustCompletedTrainerId] = useState<string | null>(null);
  const [justCompletedTrainerName, setJustCompletedTrainerName] = useState<string>("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [vendorAboutExpanded, setVendorAboutExpanded] = useState(false);
  const DESC_LIMIT = 300;

  const [appStatusFilter, setAppStatusFilter] = useState<string>("all");
  const [appPage, setAppPage] = useState(0);
  const [appSearch, setAppSearch] = useState("");
  const APP_PAGE_SIZE = 10;

  const [reviewTrainerId, setReviewTrainerId] = useState<string | null>(null);
  const [reviewTrainerName, setReviewTrainerName] = useState<string>("");
  const [reviewContent, setReviewContent] = useState(5);
  const [reviewDelivery, setReviewDelivery] = useState(5);
  const [reviewPunctuality, setReviewPunctuality] = useState(5);
  const [reviewCommunication, setReviewCommunication] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTrainerId || !reviewComment.trim()) return;
    createReview.mutate(
      {
        id: reviewTrainerId,
        data: {
          ratingContent: reviewContent,
          ratingDelivery: reviewDelivery,
          ratingPunctuality: reviewPunctuality,
          ratingCommunication: reviewCommunication,
          comment: reviewComment,
          engagementTitle: reviewTitle || requirement?.title,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Review submitted", description: "Thank you for your feedback!" });
          queryClient.invalidateQueries({ queryKey: getListTrainerReviewsQueryKey(reviewTrainerId) });
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(reviewTrainerId) });
          setReviewTrainerId(null);
          setReviewComment("");
          setReviewTitle("");
          setReviewContent(5);
          setReviewDelivery(5);
          setReviewPunctuality(5);
          setReviewCommunication(5);
        },
        onError: () => {
          toast({ title: "Error", description: "Could not submit review.", variant: "destructive" });
        },
      },
    );
  };

  const resolvedFlagReason = flagReason === "Other" ? customFlagReason.trim() : flagReason;

  const handleFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedFlagReason) return;
    flagMutation.mutate(
      { id, data: { reason: resolvedFlagReason } },
      {
        onSuccess: () => {
          toast({ title: "Requirement flagged", description: "The admin team has been notified." });
          setIsFlagOpen(false);
          setFlagReason("");
          setCustomFlagReason("");
          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to flag requirement.", variant: "destructive" });
        },
      }
    );
  };

  const DEFAULT_APPLY_MSG = "I am interested in this requirement and believe my skills and experience make me a strong fit. I look forward to discussing further.";

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    applyMutation.mutate(
      { id, data: { message: message.trim() || DEFAULT_APPLY_MSG, proposedRate: proposedRate ? Number(proposedRate) : undefined } },
      {
        onSuccess: () => {
          toast({ title: "Application submitted", description: "The vendor has been notified." });
          setIsApplyOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
        },
        onError: (err) => {
          const anyErr = err as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
          if (anyErr?.response?.status === 409 && anyErr.response.data?.error === "engaged_dates_conflict") {
            toast({
              title: "Schedule conflict",
              description: anyErr.response.data?.message ?? "You're already engaged on these dates.",
              variant: "destructive",
            });
            setIsApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId ?? "") });
            return;
          }
          toast({ title: "Error", description: "Failed to apply. You may have already applied.", variant: "destructive" });
        }
      }
    );
  };

  const handleUpdateStatus = (appId: string, status: "shortlisted" | "rejected" | "hired") => {
    updateAppMutation.mutate(
      { id: appId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Status updated" });
          queryClient.invalidateQueries({ queryKey: getListRequirementApplicationsQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleUpdateReqStatus = (status: "open" | "closed" | "vacant") => {
    updateReqMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Requirement updated" });
          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update requirement", variant: "destructive" });
        }
      }
    );
  };

  const handleExtendDeadline = () => {
    if (!newDeadline) return;
    updateReqMutation.mutate(
      { id, data: { status: "open", deadline: newDeadline } },
      {
        onSuccess: () => {
          toast({ title: "Deadline extended", description: "Requirement is still open with a new deadline." });
          setIsExtendOpen(false);
          setNewDeadline("");
          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to extend deadline", variant: "destructive" });
        }
      }
    );
  };

  if (reqLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-[400px] md:col-span-2 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Requirement not found</h2>
        <Link href="/requirements">
          <Button className="mt-6">Back to Requirements</Button>
        </Link>
      </div>
    );
  }

  const isTrainer = user?.role === "trainer";

  const engagedDates = (currentTrainer as { engagedDates?: EngagedRange[] } | undefined)?.engagedDates;
  const conflict = isTrainer
    ? findScheduleConflict(requirement.startDate, requirement.durationDays, engagedDates)
    : null;
  const formatRangeLabel = (r: EngagedRange) => {
    try {
      return `${format(new Date(r.startDate + "T00:00:00"), "MMM d, yyyy")} – ${format(
        new Date(r.endDate + "T00:00:00"),
        "MMM d, yyyy",
      )}`;
    } catch {
      return `${r.startDate} – ${r.endDate}`;
    }
  };

  const now = new Date();
  const deadlineDate = new Date(requirement.deadline);
  const daysToDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = deadlineDate < now;
  const isExpiringSoon = !isExpired && daysToDeadline <= 7;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      {requirement.status === "open" && isExpired && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 mb-6">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Application deadline has passed.{" "}
            {isVendorOwner
              ? "Extend the deadline or close this requirement."
              : "This requirement may close soon."}
          </span>
        </div>
      )}
      {requirement.status === "open" && isExpiringSoon && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-4 py-3 text-sm text-orange-800 dark:text-orange-300 mb-6">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Closes in <strong>{daysToDeadline} day{daysToDeadline === 1 ? "" : "s"}</strong>. Apply soon!
          </span>
        </div>
      )}
      <Card className="overflow-hidden border-none shadow-md mb-8 bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={requirement.status === 'open' ? 'default' : requirement.status === 'vacant' ? 'destructive' : 'secondary'} className="capitalize">
                  {requirement.status}
                </Badge>
                {(requirement as any).isUrgent && (
                  <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    <Zap className="h-3 w-3" /> Urgent
                  </span>
                )}
                {(requirement as any).isFeatured && (
                  <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
                {(requirement as any).isPrivate && (
                  <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                )}
                {(requirement as any).hireThroughUs && (
                  <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    <Handshake className="h-3 w-3" /> Hire Through Us
                  </span>
                )}
                {(requirement as any).flagged && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    Flagged
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Posted {formatDistanceToNow(new Date(requirement.createdAt), { addSuffix: true })}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{requirement.title}</h1>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{requirement.location} {requirement.remote && "(Remote OK)"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{requirement.durationDays} days</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-medium text-foreground capitalize">
                    {(requirement as any).budget > 0
                      ? `₹${((requirement as any).budget as number).toLocaleString("en-IN")}${(requirement as any).feeType === "negotiable" ? " (Negotiable)" : ""}`
                      : "Discuss payout"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{requirement.applicationCount} Applicants</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">{requirement.skill}</Badge>
                {requirement.subSkills.map((s) => (
                  <Badge key={s} variant="outline" className="font-normal text-muted-foreground">{s}</Badge>
                ))}
                {(requirement as any).audienceType && (
                  <Badge variant="outline" className="font-normal capitalize border-amber-300 text-amber-700 dark:border-amber-700/50 dark:text-amber-400">
                    Audience: {(requirement as any).audienceType === "both" ? "Freshers + Lateral" : (requirement as any).audienceType}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-4 bg-background p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Deadline</p>
              <p className="text-xl font-bold">{format(new Date(requirement.deadline), 'MMM d, yyyy')}</p>
              
              {isTrainer && !myApplication && requirement.status === 'open' && trainerLoading && (
                <Button size="lg" className="w-full mt-2" disabled aria-disabled="true">
                  Checking availability...
                </Button>
              )}
              {isTrainer && !myApplication && requirement.status === 'open' && !trainerLoading && conflict && (
                <div className="w-full mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <div className="flex items-start gap-2 text-destructive">
                    <CalendarX className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">You're already engaged on these dates.</p>
                      <p className="text-destructive/80 mt-1">
                        Conflicts with your booked period {formatRangeLabel(conflict)}
                        {conflict.note ? ` (${conflict.note})` : ""}. Update your availability in your profile to apply.
                      </p>
                    </div>
                  </div>
                  <Button size="lg" className="w-full mt-3" disabled aria-disabled="true">
                    Apply Now
                  </Button>
                </div>
              )}
              {isTrainer && !myApplication && requirement.status === 'open' && !trainerLoading && !conflict && (
                <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="w-full mt-2">Apply Now</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Apply for this Requirement</DialogTitle>
                      <DialogDescription>Submit your proposal to {requirement.vendorName}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleApply} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="proposedRate">
                          Proposed Rate (Total) <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <Input
                          id="proposedRate"
                          type="number"
                          min={0}
                          placeholder="Leave blank to discuss directly"
                          value={proposedRate}
                          onChange={(e) => setProposedRate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">
                          Message <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <Textarea
                          id="message"
                          placeholder="Introduce yourself and explain why you're a good fit… (a default message will be used if left blank)"
                          rows={4}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={applyMutation.isPending}>
                        {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              {isTrainer && myApplication && (myApplication.status === 'submitted' || myApplication.status === 'rejected' || myApplication.status === 'withdrawn') && (
                <div className={`w-full mt-2 rounded-md border p-3 text-sm ${myApplication.status === 'rejected' || myApplication.status === 'withdrawn' ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    {myApplication.status === 'rejected' || myApplication.status === 'withdrawn'
                      ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      : <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <p className={`font-medium ${myApplication.status === 'rejected' || myApplication.status === 'withdrawn' ? 'text-destructive' : 'text-foreground'}`}>
                      {myApplication.status === 'rejected' ? 'Application not selected'
                        : myApplication.status === 'withdrawn' ? 'You withdrew this application'
                        : 'Application submitted'}
                    </p>
                  </div>
                  {myApplication.status === 'submitted' && (
                    <p className="text-muted-foreground mt-1 ml-6 text-xs">The vendor will review and shortlist if you're a good fit.</p>
                  )}
                  {myApplication.status === 'withdrawn' && (myApplication as any).withdrawnReason && (
                    <p className="text-muted-foreground mt-1 ml-6 text-xs italic">"{(myApplication as any).withdrawnReason}"</p>
                  )}
                </div>
              )}
              {isTrainer && myApplication && (myApplication.status === 'shortlisted' || myApplication.status === 'hired') && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full mt-2 gap-2"
                  onClick={() => {
                    setMessageAppId(myApplication.id);
                    setMessageAppName(requirement.vendorName ?? "Vendor");
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Message {requirement.vendorName}
                </Button>
              )}
              {isTrainer && myApplication && (myApplication.status === 'hired' || myApplication.status === 'completed') && (
                <div className="mt-3">
                  <AgreementSection applicationId={myApplication.id} role="trainer" />
                </div>
              )}
              {isTrainer && myApplication && myApplication.status !== 'rejected' && myApplication.status !== 'withdrawn' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
                  onClick={() => { setWithdrawReason(""); setIsWithdrawOpen(true); }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Withdraw Application
                </Button>
              )}
              {isVendorOwner && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {requirement.status === 'open' && (
                    <Button variant="outline" onClick={() => setIsCloseConfirmOpen(true)} disabled={updateReqMutation.isPending}>Close</Button>
                  )}
                  {requirement.status === 'open' && new Date() > new Date(requirement.deadline) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNewDeadline("");
                        setIsExtendOpen(true);
                      }}
                      disabled={updateReqMutation.isPending}
                    >
                      Still Looking — Extend Deadline
                    </Button>
                  )}
                  {requirement.status !== 'open' && (
                    <Button variant="outline" onClick={() => handleUpdateReqStatus('open')} disabled={updateReqMutation.isPending}>Reopen</Button>
                  )}
                </div>
              )}

              {/* Close Requirement confirmation dialog */}
              <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close this requirement?</DialogTitle>
                    <DialogDescription>
                      Closing will hide it from trainers and stop new applications. You can reopen it at any time.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsCloseConfirmOpen(false)}>Cancel</Button>
                    <Button
                      variant="destructive"
                      disabled={updateReqMutation.isPending}
                      onClick={() => {
                        setIsCloseConfirmOpen(false);
                        handleUpdateReqStatus('closed');
                      }}
                    >
                      {updateReqMutation.isPending ? "Closing…" : "Yes, close it"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Extend Deadline dialog */}
              <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Still Looking for a Trainer?</DialogTitle>
                    <DialogDescription>
                      Your application deadline has passed but no trainer has been hired yet.
                      Set a new deadline to keep this requirement open and visible to trainers.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <Label htmlFor="new-deadline">New Application Deadline</Label>
                    <Input
                      id="new-deadline"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsExtendOpen(false)}>Cancel</Button>
                    <Button onClick={handleExtendDeadline} disabled={!newDeadline || updateReqMutation.isPending}>
                      {updateReqMutation.isPending ? "Saving…" : "Extend Deadline"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              {isAdmin && (
                <div className="mt-2">
                  <AdminRemoveButton
                    variant="full"
                    label={`requirement "${requirement.title}"`}
                    description={`This permanently removes this requirement and all applications submitted to it. This cannot be undone.`}
                    successMessage="Requirement removed."
                    onConfirm={async () => {
                      await deleteRequirement.mutateAsync({ id });
                      await queryClient.invalidateQueries({
                        queryKey: getListRequirementsQueryKey(),
                      });
                      navigate("/requirements");
                    }}
                  />
                </div>
              )}
              {isTrainer && !(requirement as any).flagged && (
                <Dialog open={isFlagOpen} onOpenChange={setIsFlagOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-muted-foreground border-muted-foreground/30 hover:border-destructive/50 hover:text-destructive">
                      <Flag className="h-3.5 w-3.5" />
                      Flag this Requirement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Flag Requirement
                      </DialogTitle>
                      <DialogDescription>
                        Report a concern about this requirement to the admin team. Only use this for genuine issues.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFlag} className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <div className="grid grid-cols-1 gap-1.5">
                          {[
                            "Misleading or inaccurate information",
                            "Spam or duplicate listing",
                            "Inappropriate or offensive content",
                            "Unrealistic expectations or pay",
                            "Suspected fraud",
                            "Other",
                          ].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setFlagReason(r)}
                              className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                                flagReason === r
                                  ? "border-destructive bg-destructive/10 text-destructive"
                                  : "border-input hover:border-muted-foreground/50"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        {flagReason === "Other" && (
                          <Textarea
                            placeholder="Describe the issue…"
                            className="mt-2 min-h-[80px]"
                            value={customFlagReason}
                            onChange={(e) => setCustomFlagReason(e.target.value)}
                          />
                        )}
                      </div>
                      <Button
                        type="submit"
                        variant="destructive"
                        className="w-full gap-2"
                        disabled={!resolvedFlagReason || flagMutation.isPending}
                      >
                        <Flag className="h-4 w-4" />
                        {flagMutation.isPending ? "Flagging…" : "Submit Flag"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              {isTrainer && (requirement as any).flagged && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <Flag className="h-3.5 w-3.5" />
                  You have flagged this requirement
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const full = requirement.description ?? "";
                const needsTruncation = full.length > DESC_LIMIT;
                const shown = needsTruncation && !descExpanded ? full.slice(0, DESC_LIMIT).trimEnd() + "…" : full;
                return (
                  <>
                    <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                      {shown}
                    </div>
                    {needsTruncation && (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((v) => !v)}
                        className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {descExpanded ? (
                          <><ChevronUp className="h-4 w-4" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-4 w-4" /> Read more</>
                        )}
                      </button>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {isVendorOwner && (() => {
            const STATUS_TABS = ["all", "submitted", "shortlisted", "hired", "completed", "rejected", "withdrawn"] as const;
            const STATUS_COLORS: Record<string, string> = {
              submitted: "text-blue-600 bg-blue-50 border-blue-200",
              shortlisted: "text-amber-600 bg-amber-50 border-amber-200",
              hired: "text-green-600 bg-green-50 border-green-200",
              completed: "text-teal-600 bg-teal-50 border-teal-200",
              rejected: "text-red-600 bg-red-50 border-red-200",
              withdrawn: "text-orange-600 bg-orange-50 border-orange-200",
            };
            const allApps = applications ?? [];
            const nameFiltered = appSearch.trim()
              ? allApps.filter(a => a.trainer.name.toLowerCase().includes(appSearch.trim().toLowerCase()))
              : allApps;
            const counts = STATUS_TABS.reduce<Record<string, number>>((acc, s) => {
              acc[s] = s === "all" ? nameFiltered.length : nameFiltered.filter(a => a.status === s).length;
              return acc;
            }, {});
            const filtered = appStatusFilter === "all" ? nameFiltered : nameFiltered.filter(a => a.status === appStatusFilter);
            const totalPages = Math.ceil(filtered.length / APP_PAGE_SIZE);
            const pageApps = filtered.slice(appPage * APP_PAGE_SIZE, (appPage + 1) * APP_PAGE_SIZE);
            const hasWithdrawn = allApps.some(a => a.status === "withdrawn");

            return (
              <div className="space-y-3">
                {hasWithdrawn && requirement.status !== "open" && (
                  <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-4 py-3 text-sm text-orange-800 dark:text-orange-300">
                    <RotateCcw className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">A trainer has withdrawn their application.</p>
                      <p className="mt-0.5 text-orange-700/80 dark:text-orange-400/80">You may want to reopen this requirement to find a replacement.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400"
                      disabled={updateReqMutation.isPending}
                      onClick={() => handleUpdateReqStatus("open")}
                    >
                      Reopen
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-2xl font-bold">Applications ({requirement.applicationCount})</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const hasHired = allApps.some(a => a.status === "hired");
                      const remainingCount = allApps.filter(a => a.status === "submitted" || a.status === "shortlisted").length;
                      if (!hasHired || remainingCount === 0) return null;
                      return (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                            onClick={() => setIsBulkRejectOpen(true)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject remaining ({remainingCount})
                          </Button>
                          <Dialog open={isBulkRejectOpen} onOpenChange={setIsBulkRejectOpen}>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject remaining applicants?</DialogTitle>
                                <DialogDescription>
                                  This will reject all <strong>{remainingCount}</strong> submitted or shortlisted applicant{remainingCount === 1 ? "" : "s"} for this requirement. Each trainer will receive an email notification. This cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsBulkRejectOpen(false)}>Cancel</Button>
                                <Button
                                  variant="destructive"
                                  disabled={bulkRejectMutation.isPending}
                                  onClick={() => {
                                    bulkRejectMutation.mutate(
                                      { id },
                                      {
                                        onSuccess: (result) => {
                                          toast({ title: "Done", description: `${result.rejectedCount} applicant${result.rejectedCount === 1 ? "" : "s"} rejected.` });
                                          setIsBulkRejectOpen(false);
                                          queryClient.invalidateQueries({ queryKey: getListRequirementApplicationsQueryKey(id) });
                                          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
                                        },
                                        onError: () => {
                                          toast({ title: "Error", description: "Failed to reject applicants.", variant: "destructive" });
                                        },
                                      }
                                    );
                                  }}
                                >
                                  {bulkRejectMutation.isPending ? "Rejecting…" : `Yes, reject ${remainingCount}`}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      );
                    })()}
                    <div className="w-full sm:w-64">
                      <Input
                        placeholder="Search by trainer name..."
                        value={appSearch}
                        onChange={(e) => { setAppSearch(e.target.value); setAppPage(0); }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {appsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : allApps.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      No applications yet.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Tabs value={appStatusFilter} onValueChange={(v) => { setAppStatusFilter(v); setAppPage(0); }}>
                      <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
                        {STATUS_TABS.map(s => (
                          <TabsTrigger key={s} value={s} className="capitalize text-xs gap-1.5">
                            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                            <span className="bg-background/70 text-muted-foreground rounded-full px-1.5 py-0 text-[10px] font-medium leading-4">
                              {counts[s]}
                            </span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>

                    {justCompletedTrainerId && (
                      <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-800 px-4 py-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-teal-800 dark:text-teal-300">Training marked as completed!</p>
                          <p className="text-teal-700/80 dark:text-teal-400/80 mt-0.5">How did {justCompletedTrainerName} perform? A review helps other vendors make informed decisions.</p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => {
                            setReviewTrainerId(justCompletedTrainerId);
                            setReviewTrainerName(justCompletedTrainerName);
                            setJustCompletedTrainerId(null);
                          }}
                        >
                          Leave a review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40"
                          onClick={() => setJustCompletedTrainerId(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}

                    <Card>
                      <div className="divide-y divide-border">
                        {pageApps.length === 0 ? (
                          <div className="p-8 text-center text-sm text-muted-foreground">No {appStatusFilter} applications.</div>
                        ) : pageApps.map((app) => (
                          <div key={app.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                            <TrainerAvatar name={app.trainer.name} avatarUrl={app.trainer.avatarUrl} className="h-9 w-9 shrink-0" fallbackClassName="text-xs" />

                            <div className="flex-1 min-w-0">
                              <Link href={`/trainers/${app.trainer.id}`} className="font-medium text-sm hover:underline leading-tight line-clamp-1">
                                {app.trainer.name}
                              </Link>
                              <p className="text-xs text-muted-foreground line-clamp-1">{app.trainer.headline}</p>
                            </div>

                            <div className="hidden sm:flex items-center gap-1 shrink-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <Eye className="h-3.5 w-3.5" />
                                    Note
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-72 p-3 text-sm text-muted-foreground italic">
                                  "{app.message}"
                                  {app.proposedRate != null && (
                                    <p className="mt-2 not-italic text-xs font-medium text-foreground">Rate: ₹{app.proposedRate}</p>
                                  )}
                                  {app.status === "withdrawn" && (app as any).withdrawnReason && (
                                    <p className="mt-2 not-italic text-xs text-orange-600">
                                      <span className="font-medium">Withdrawal reason:</span> {(app as any).withdrawnReason}
                                    </p>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </div>

                            <Badge variant="outline" className={`capitalize text-xs shrink-0 hidden xs:inline-flex ${STATUS_COLORS[app.status] ?? ""}`}>
                              {app.status}
                            </Badge>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title={app.vendorNote ? "Edit note" : "Add note"}
                                onClick={() => {
                                  setNoteAppId(app.id);
                                  setNoteDraft(app.vendorNote ?? "");
                                }}
                              >
                                <StickyNote className={`h-3.5 w-3.5 ${app.vendorNote ? "text-amber-500 fill-amber-200" : "text-muted-foreground"}`} />
                              </Button>
                              {app.status === "submitted" && (
                                <>
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleUpdateStatus(app.id, "shortlisted")}>Shortlist</Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleUpdateStatus(app.id, "rejected")}>Reject</Button>
                                </>
                              )}
                              {app.status === "shortlisted" && (
                                <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(app.id, "hired")}>Hire</Button>
                              )}
                              {(app.status === "shortlisted" || app.status === "hired") && (
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setMessageAppId(app.id); setMessageAppName(app.trainer.name); }}>
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {app.status === "hired" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs gap-1 text-teal-700 border-teal-300 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700 dark:hover:bg-teal-950/40"
                                    onClick={() => setCompletingAppId(app.id)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Complete
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setReviewTrainerId(app.trainer.id); setReviewTrainerName(app.trainer.name); }}>
                                    <Star className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {(() => {
                      const hiredApps = allApps.filter(a => a.status === 'hired' || a.status === 'completed');
                      if (hiredApps.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mt-2">
                            <Handshake className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm">Engagement Agreements</h3>
                          </div>
                          {hiredApps.map(app => (
                            <div key={`ag-${app.id}`}>
                              <p className="text-xs text-muted-foreground mb-1">With {app.trainer.name}</p>
                              <AgreementSection applicationId={app.id} role="vendor" />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                        <span>
                          {appPage * APP_PAGE_SIZE + 1}–{Math.min((appPage + 1) * APP_PAGE_SIZE, filtered.length)} of {filtered.length}
                        </span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={appPage === 0} onClick={() => setAppPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={appPage >= totalPages - 1} onClick={() => setAppPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">About the Vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border rounded-md">
                  <AvatarImage src={requirement.vendor.logoUrl} />
                  <AvatarFallback className="rounded-md"><Building /></AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold">{requirement.vendor.companyName}</h3>
                    {requirement.vendorVerified && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center text-primary cursor-default">
                            <ShieldCheck className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>This company is verified by Trainers Hive</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{requirement.vendor.industry}</p>
                </div>
              </div>
              {requirement.vendor.about && (() => {
                const full = requirement.vendor.about;
                const needsTruncation = full.length > DESC_LIMIT;
                const shown = needsTruncation && !vendorAboutExpanded ? full.slice(0, DESC_LIMIT).trimEnd() + "…" : full;
                return (
                  <div>
                    <p className="text-sm text-muted-foreground">{shown}</p>
                    {needsTruncation && (
                      <button
                        type="button"
                        onClick={() => setVendorAboutExpanded((v) => !v)}
                        className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {vendorAboutExpanded ? (
                          <><ChevronUp className="h-4 w-4" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-4 w-4" /> Read more</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })()}
              <div className="space-y-2 text-sm pt-2 border-t">
                <p><strong>Role:</strong> {requirement.vendor.contactDesignation}</p>
                <p><strong>Location:</strong> {requirement.vendor.location}</p>
              </div>
            </CardContent>
          </Card>

          {isVendorOwner && (aiMatchesLoading || (aiMatches && aiMatches.length > 0)) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  AI Best Matches
                </CardTitle>
                <CardDescription>Top trainers ranked by AI for this requirement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiMatchesLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center pt-1">AI is analysing trainer profiles…</p>
                  </div>
                )}
                {aiMatches && aiMatches.length > 0 && aiMatches.map((match, idx) => (
                  <div key={match.trainerId} className="flex items-start gap-3 group">
                    <div className="relative shrink-0">
                      <TrainerAvatar name={match.name} avatarUrl={match.avatarUrl} className="h-9 w-9" />
                      <span className="absolute -top-1 -left-1 bg-violet-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{match.name}</p>
                        {match.verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        <span className="text-xs font-medium text-amber-600 ml-auto shrink-0">★ {match.rating.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {match.mainSkill}
                        {match.experienceYears > 0 ? ` · ${match.experienceYears}y exp` : ""}
                        {match.location ? ` · ${match.location}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{match.reason}"</p>
                    </div>
                    <Link href={`/trainers/${match.trainerId}`} className="shrink-0 self-start pt-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1">
                        View Profile <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isVendorOrAdmin && (suggestedLoading || (suggestedTrainers && suggestedTrainers.length > 0)) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Suggested Trainers</CardTitle>
                <CardDescription>Trainers whose skills match this requirement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestedLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))
                ) : (
                  suggestedTrainers?.map((trainer) => (
                    <div key={trainer.id} className="flex items-center gap-3 group">
                      <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} className="h-9 w-9 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{trainer.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{trainer.mainSkill}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs font-medium text-amber-600">★ {trainer.rating.toFixed(1)}</span>
                        <Link href={`/trainers/${trainer.id}`}>
                          <span className="text-xs text-primary hover:underline flex items-center gap-0.5">
                            View Profile <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mark Completed confirmation dialog */}
      <Dialog open={!!completingAppId} onOpenChange={(open) => { if (!open) setCompletingAppId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark training as completed?</DialogTitle>
            <DialogDescription>
              This will record the engagement as complete, close the requirement, and update the trainer's completed training count. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 my-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Please confirm the engagement agreement with this trainer is signed by both parties before marking complete.
              You can review or sign it in the <strong>Engagement Agreements</strong> section above.
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompletingAppId(null)}>Cancel</Button>
            <Button
              disabled={completeMutation.isPending}
              onClick={() => {
                if (!completingAppId) return;
                const app = applications?.find(a => a.id === completingAppId);
                completeMutation.mutate(
                  { id: completingAppId },
                  {
                    onSuccess: () => {
                      toast({ title: "Training completed", description: "The requirement has been closed." });
                      const trainerName = app?.trainer.name ?? "";
                      const trainerId = app?.trainer.id ?? "";
                      setCompletingAppId(null);
                      if (trainerId) {
                        setJustCompletedTrainerId(trainerId);
                        setJustCompletedTrainerName(trainerName);
                      }
                      queryClient.invalidateQueries({ queryKey: getListRequirementApplicationsQueryKey(id) });
                      queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
                      queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                      if (trainerId) {
                        queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
                      }
                    },
                    onError: () => {
                      toast({ title: "Error", description: "Could not mark as completed.", variant: "destructive" });
                      setCompletingAppId(null);
                    },
                  }
                );
              }}
            >
              {completeMutation.isPending ? "Completing…" : "Yes, mark completed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trainer withdraw dialog */}
      <Dialog open={isWithdrawOpen} onOpenChange={(open) => { if (!open) setIsWithdrawOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>
              This will notify the vendor. If you were already hired, they will be alerted immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="rd-withdraw-reason">Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea
              id="rd-withdraw-reason"
              placeholder="e.g. Schedule conflict, personal reasons…"
              rows={3}
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={withdrawMutation.isPending}
              onClick={() => {
                if (!myApplication) return;
                withdrawMutation.mutate(
                  { id: myApplication.id, data: { reason: withdrawReason.trim() || undefined } },
                  {
                    onSuccess: () => {
                      setIsWithdrawOpen(false);
                      toast({ title: "Application withdrawn" });
                      queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
                    },
                    onError: () => {
                      setIsWithdrawOpen(false);
                      toast({ title: "Error", description: "Could not withdraw application.", variant: "destructive" });
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

      {/* Vendor note dialog */}
      <Dialog open={!!noteAppId} onOpenChange={(open) => { if (!open) setNoteAppId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Private Note
            </DialogTitle>
            <DialogDescription>
              Only you can see this note. It persists across sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Textarea
              placeholder="e.g. Strong React background, budget too high…"
              rows={4}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              disabled={updateNoteMutation.isPending}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setNoteAppId(null)} disabled={updateNoteMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={updateNoteMutation.isPending}
              onClick={() => {
                if (!noteAppId) return;
                updateNoteMutation.mutate(
                  { id: noteAppId, data: { note: noteDraft } },
                  {
                    onSuccess: () => {
                      toast({ title: "Note saved" });
                      setNoteAppId(null);
                      queryClient.invalidateQueries({ queryKey: getListRequirementApplicationsQueryKey(id) });
                    },
                    onError: () => {
                      toast({ title: "Error", description: "Could not save note.", variant: "destructive" });
                    },
                  }
                );
              }}
            >
              {updateNoteMutation.isPending ? "Saving…" : "Save Note"}
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
          title={`Message — ${messageAppName}`}
        />
      )}

      <Dialog open={!!reviewTrainerId} onOpenChange={(open) => { if (!open) setReviewTrainerId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review {reviewTrainerName}</DialogTitle>
            <DialogDescription>Rate this trainer across 4 dimensions. Your review helps other vendors make informed decisions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitReview} className="space-y-4 pt-2">
            <div className="space-y-3">
              <Label>Ratings</Label>
              {(
                [
                  { label: "Content Quality", value: reviewContent, set: setReviewContent },
                  { label: "Delivery", value: reviewDelivery, set: setReviewDelivery },
                  { label: "Punctuality", value: reviewPunctuality, set: setReviewPunctuality },
                  { label: "Communication", value: reviewCommunication, set: setReviewCommunication },
                ] as const
              ).map(({ label, value, set }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-sm w-36 shrink-0">{label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => set(star)}
                        className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star className={`h-5 w-5 ${value >= star ? 'fill-amber-500 text-amber-500' : 'text-muted'}`} />
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-1 w-4">{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-title">Engagement title (optional)</Label>
              <Input
                id="review-title"
                placeholder={requirement?.title ?? "e.g. Advanced React Workshop"}
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                disabled={createReview.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                placeholder="How was the training? What did they do well?"
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={createReview.isPending}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={createReview.isPending || !reviewComment.trim()}>
              {createReview.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
