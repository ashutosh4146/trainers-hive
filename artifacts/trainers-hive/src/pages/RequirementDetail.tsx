import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequirement,
  useListRequirementApplications,
  useGetCurrentUser,
  useApplyToRequirement,
  useUpdateApplicationStatus,
  useUpdateRequirement,
  useDeleteRequirement,
  getGetRequirementQueryKey,
  getListRequirementApplicationsQueryKey,
  getListRequirementsQueryKey
} from "@workspace/api-client-react";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
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
import { Building, MapPin, Briefcase, BookOpen, Clock, Users, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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

  const applyMutation = useApplyToRequirement();
  const updateAppMutation = useUpdateApplicationStatus();
  const updateReqMutation = useUpdateRequirement();

  const [message, setMessage] = useState("");
  const [proposedRate, setProposedRate] = useState<string>("");
  const [isApplyOpen, setIsApplyOpen] = useState(false);

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
        onError: () => {
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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      <Card className="overflow-hidden border-none shadow-md mb-8 bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant={requirement.status === 'open' ? 'default' : requirement.status === 'vacant' ? 'destructive' : 'secondary'} className="capitalize">
                  {requirement.status}
                </Badge>
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
              
              {isTrainer && requirement.status === 'open' && (
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
                          
                          <div className="flex gap-2 pt-2">
                            {app.status === 'submitted' && (
                              <>
                                <Button size="sm" onClick={() => handleUpdateStatus(app.id, 'shortlisted')}>Shortlist</Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleUpdateStatus(app.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                            {app.status === 'shortlisted' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(app.id, 'hired')}>Hire</Button>
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
    </div>
  );
}
