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
  getListMyApplicationsQueryKey,
  getGetRequirementQueryKey,
  getGetTrainerQueryKey,
  getListRequirementApplicationsQueryKey,
  getListRequirementsQueryKey
} from "@workspace/api-client-react";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { MessageThread } from "@/components/MessageThread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building, MapPin, Briefcase, BookOpen, Clock, Users, CheckCircle2, XCircle, ArrowRight, CalendarX, Flag, AlertTriangle, MessageSquare } from "lucide-react";
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

  const applyMutation = useApplyToRequirement();
  const updateAppMutation = useUpdateApplicationStatus();
  const updateReqMutation = useUpdateRequirement();
  const flagMutation = useFlagRequirement();
  const unflagMutation = useUnflagRequirement();

  const [message, setMessage] = useState("");
  const [proposedRate, setProposedRate] = useState<string>("");
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isFlagOpen, setIsFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [customFlagReason, setCustomFlagReason] = useState("");
  const [messageAppId, setMessageAppId] = useState<string | null>(null);
  const [messageAppName, setMessageAppName] = useState<string>("");

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

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !proposedRate) return;

    applyMutation.mutate(
      { id, data: { message, proposedRate: Number(proposedRate) } },
      {
        onSuccess: () => {
          toast({ title: "Application submitted", description: "The vendor has been notified." });
          setIsApplyOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetRequirementQueryKey(id) });
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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      <Card className="overflow-hidden border-none shadow-md mb-8 bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={requirement.status === 'open' ? 'default' : requirement.status === 'vacant' ? 'destructive' : 'secondary'} className="capitalize">
                  {requirement.status}
                </Badge>
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
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-4 bg-background p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Deadline</p>
              <p className="text-xl font-bold">{format(new Date(requirement.deadline), 'MMM d, yyyy')}</p>
              
              {isTrainer && requirement.status === 'open' && trainerLoading && (
                <Button size="lg" className="w-full mt-2" disabled aria-disabled="true">
                  Checking availability...
                </Button>
              )}
              {isTrainer && requirement.status === 'open' && !trainerLoading && conflict && (
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
              {isTrainer && requirement.status === 'open' && !trainerLoading && !conflict && (
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
                        <Label htmlFor="proposedRate">Proposed Rate (Total)</Label>
                        <Input
                          id="proposedRate"
                          type="number"
                          min={0}
                          value={proposedRate}
                          onChange={(e) => setProposedRate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          placeholder="Introduce yourself and explain why you're a good fit..."
                          rows={4}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={applyMutation.isPending}>
                        {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
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
              {isVendorOwner && (
                <div className="flex gap-2 mt-2">
                  {requirement.status === 'open' && (
                    <Button variant="outline" onClick={() => handleUpdateReqStatus('closed')} disabled={updateReqMutation.isPending}>Close</Button>
                  )}
                  {requirement.status === 'open' && (
                    <Button variant="destructive" onClick={() => handleUpdateReqStatus('vacant')} disabled={updateReqMutation.isPending}>Mark Vacant</Button>
                  )}
                  {requirement.status !== 'open' && (
                    <Button variant="outline" onClick={() => handleUpdateReqStatus('open')} disabled={updateReqMutation.isPending}>Reopen</Button>
                  )}
                </div>
              )}
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
              <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                {requirement.description}
              </div>
            </CardContent>
          </Card>

          {isVendorOwner && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Applications ({requirement.applicationCount})</h2>
              {appsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : applications?.length ? (
                applications.map((app) => (
                  <Card key={app.id}>
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={app.trainer.avatarUrl} />
                          <AvatarFallback>{app.trainer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link href={`/trainers/${app.trainer.id}`} className="font-semibold text-lg hover:underline">
                                {app.trainer.name}
                              </Link>
                              <p className="text-sm text-muted-foreground">{app.trainer.headline}</p>
                            </div>
                            <Badge variant="outline" className="capitalize">{app.status}</Badge>
                          </div>
                          <p className="text-sm font-medium">Proposed Rate: ${app.proposedRate}</p>
                          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md italic">"{app.message}"</p>
                          
                          <div className="flex gap-2 pt-2 flex-wrap">
                            {app.status === 'submitted' && (
                              <>
                                <Button size="sm" onClick={() => handleUpdateStatus(app.id, 'shortlisted')}>Shortlist</Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleUpdateStatus(app.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                            {app.status === 'shortlisted' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(app.id, 'hired')}>Hire</Button>
                            )}
                            {(app.status === 'shortlisted' || app.status === 'hired') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  setMessageAppId(app.id);
                                  setMessageAppName(app.trainer.name);
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Message
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    No applications yet.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
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
                  <h3 className="font-semibold">{requirement.vendor.companyName}</h3>
                  <p className="text-sm text-muted-foreground">{requirement.vendor.industry}</p>
                </div>
              </div>
              {requirement.vendor.about && (
                <p className="text-sm text-muted-foreground">{requirement.vendor.about}</p>
              )}
              <div className="space-y-2 text-sm pt-2 border-t">
                <p><strong>Contact:</strong> {requirement.vendor.contactName}</p>
                <p><strong>Role:</strong> {requirement.vendor.contactDesignation}</p>
                <p><strong>Location:</strong> {requirement.vendor.location}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {messageAppId && user?.id && (
        <MessageThread
          applicationId={messageAppId}
          currentUserId={user.id}
          open={!!messageAppId}
          onOpenChange={(open) => { if (!open) setMessageAppId(null); }}
          title={`Message — ${messageAppName}`}
        />
      )}
    </div>
  );
}
