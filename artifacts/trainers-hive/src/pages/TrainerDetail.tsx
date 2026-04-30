import React, { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTrainer,
  useListTrainerReviews,
  useGetCurrentUser,
  useCreateTrainerReview,
  useDeleteTrainer,
  useListSavedTrainers,
  useSaveTrainer,
  useUnsaveTrainer,
  getGetTrainerQueryKey,
  getListTrainerReviewsQueryKey,
  getListTrainersQueryKey,
  getListSavedTrainersQueryKey,
} from "@workspace/api-client-react";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star, MapPin, Briefcase, Award, Languages, GraduationCap, Clock, MessageSquare, CheckCircle2, ShieldCheck, Loader2, CalendarDays, Bookmark } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type EngagedRange = { startDate: string; endDate: string; note?: string };

export default function TrainerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useGetCurrentUser();
  const { data: trainer, isLoading: trainerLoading } = useGetTrainer(id, {
    query: { enabled: !!id, queryKey: getGetTrainerQueryKey(id) },
  });
  const { data: reviews, isLoading: reviewsLoading } = useListTrainerReviews(id, {
    query: { enabled: !!id, queryKey: getListTrainerReviewsQueryKey(id) },
  });

  const createReview = useCreateTrainerReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [engagementTitle, setEngagementTitle] = useState("");

  const isTrainerSelf = user?.role === "trainer" && user.trainerId === id;
  const isVendor = user?.role === "vendor";
  const isAdmin = user?.role === "admin";
  const vendorId = user?.role === "vendor" ? user.vendorId : undefined;
  const deleteTrainer = useDeleteTrainer();
  const [, navigate] = useLocation();

  const { data: savedTrainers } = useListSavedTrainers(vendorId ?? "", {
    query: { enabled: !!vendorId, queryKey: getListSavedTrainersQueryKey(vendorId ?? "") },
  });
  const isSaved = savedTrainers?.some((s) => s.trainerId === id) ?? false;
  const saveTrainer = useSaveTrainer();
  const unsaveTrainer = useUnsaveTrainer();

  const handleToggleSave = () => {
    if (!vendorId) return;
    if (isSaved) {
      unsaveTrainer.mutate(
        { id: vendorId, trainerId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
            toast({ title: "Removed from saved trainers" });
          },
          onError: () => toast({ title: "Error", description: "Could not remove bookmark.", variant: "destructive" }),
        },
      );
    } else {
      saveTrainer.mutate(
        { id: vendorId, data: { trainerId: id } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
            toast({ title: "Trainer saved!", description: "Find them in your dashboard." });
          },
          onError: () => toast({ title: "Error", description: "Could not save trainer.", variant: "destructive" }),
        },
      );
    }
  };

  const [vreq, setVreq] = useState<{ id: string; status: string } | null | undefined>(undefined);
  const [isSubmittingVreq, setIsSubmittingVreq] = useState(false);
  const [vreqMessage, setVreqMessage] = useState("");
  const [showVreqForm, setShowVreqForm] = useState(false);

  useEffect(() => {
    if (!isTrainerSelf) return;
    fetch("/api/verification-requests/my")
      .then(r => r.json())
      .then(data => setVreq(data))
      .catch(() => setVreq(null));
  }, [isTrainerSelf]);

  const handleApplyVerification = async () => {
    setIsSubmittingVreq(true);
    try {
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: vreqMessage.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setVreq(data);
        setShowVreqForm(false);
        toast({ title: "Request submitted!", description: "Your verification request has been sent to the admin." });
      } else {
        const err = await res.json();
        toast({ title: "Could not submit", description: err.error || "Please try again.", variant: "destructive" });
      }
    } finally {
      setIsSubmittingVreq(false);
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    createReview.mutate(
      { id, data: { rating, comment, engagementTitle } },
      {
        onSuccess: () => {
          toast({ title: "Review submitted", description: "Thank you for your feedback!" });
          setRating(5);
          setComment("");
          setEngagementTitle("");
          queryClient.invalidateQueries({ queryKey: getListTrainerReviewsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to submit review. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  if (trainerLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-[400px] md:col-span-2 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Trainer not found</h2>
        <p className="text-muted-foreground mt-2">The trainer you're looking for doesn't exist or has been removed.</p>
        <Link href="/trainers">
          <Button className="mt-6">Back to Trainers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      {/* Hero Section */}
      <Card className="overflow-hidden border-none shadow-md mb-8 bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <Avatar className="h-32 w-32 border-4 border-background shadow-lg shrink-0">
              <AvatarImage src={trainer.avatarUrl} alt={trainer.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-4xl">{trainer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{trainer.name}</h1>
                {trainer.verified && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-lg sm:text-xl text-muted-foreground font-medium">{trainer.headline}</p>
              
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{trainer.location} {trainer.remote && "(Remote OK)"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span>{trainer.experienceYears}y Experience</span>
                </div>
                <div className="flex items-center gap-2 text-amber-500 font-medium">
                  <Star className="h-4 w-4 fill-amber-500" />
                  <span>{trainer.rating.toFixed(1)} ({trainer.reviewCount} reviews)</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                  {trainer.mainSkill}
                </Badge>
                {trainer.subSkills.map((skill) => (
                  <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-4 shrink-0 md:pl-6 md:border-l md:border-border/50 self-stretch justify-center">
              <div className="text-left md:text-right">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">Hourly Rate</p>
                <p className="text-3xl font-bold text-foreground">${trainer.hourlyRate}</p>
              </div>
              {isTrainerSelf ? (
                <>
                  <Link href="/profile" className="w-full md:w-auto">
                    <Button variant="outline" className="w-full">Edit Profile</Button>
                  </Link>
                  {!trainer.verified && (
                    vreq === undefined ? null :
                    vreq === null || vreq.status === "rejected" ? (
                      showVreqForm ? (
                        <div className="w-full space-y-2">
                          <Textarea
                            placeholder="Optional: describe your expertise, certifications, or why you'd like to be verified..."
                            value={vreqMessage}
                            onChange={e => setVreqMessage(e.target.value)}
                            className="text-sm resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" onClick={handleApplyVerification} disabled={isSubmittingVreq}>
                              {isSubmittingVreq ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowVreqForm(false)}>Cancel</Button>
                          </div>
                          {vreq?.status === "rejected" && (
                            <p className="text-xs text-red-500">Your previous request was rejected. You can apply again.</p>
                          )}
                        </div>
                      ) : (
                        <Button variant="outline" className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setShowVreqForm(true)}>
                          <ShieldCheck className="h-4 w-4" />
                          Apply for Verification
                        </Button>
                      )
                    ) : vreq.status === "pending" ? (
                      <div className="w-full text-center py-1.5 px-3 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center justify-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verification pending review
                      </div>
                    ) : null
                  )}
                </>
              ) : user?.role === "vendor" ? (
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <Link href="/requirements" className="w-full md:w-auto">
                    <Button className="w-full md:w-auto">Invite to Requirement</Button>
                  </Link>
                  <Button
                    variant="outline"
                    className={`w-full gap-2 ${isSaved ? "border-primary text-primary bg-primary/5" : ""}`}
                    onClick={handleToggleSave}
                    disabled={saveTrainer.isPending || unsaveTrainer.isPending}
                  >
                    <Bookmark className={`h-4 w-4 ${isSaved ? "fill-primary" : ""}`} />
                    {isSaved ? "Saved" : "Save Trainer"}
                  </Button>
                </div>
              ) : null}
              {isAdmin && (
                <AdminRemoveButton
                  variant="full"
                  label={`trainer ${trainer.name}`}
                  description={`This permanently removes ${trainer.name} from the marketplace, along with all their reviews and applications. This cannot be undone.`}
                  successMessage={`${trainer.name} has been removed.`}
                  className="w-full md:w-auto"
                  onConfirm={async () => {
                    await deleteTrainer.mutateAsync({ id });
                    await queryClient.invalidateQueries({
                      queryKey: getListTrainersQueryKey(),
                    });
                    navigate("/trainers");
                  }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
              <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">About</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Reviews ({trainer.reviewCount})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="about" className="space-y-8 mt-0 focus-visible:outline-none">
              <section className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" /> Biography
                </h3>
                <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  <p className="whitespace-pre-wrap">{trainer.bio || "No biography provided yet."}</p>
                </div>
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {trainer.certifications && trainer.certifications.length > 0 && (
                  <section className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Award className="h-5 w-5 text-muted-foreground" /> Certifications
                    </h3>
                    <ul className="space-y-2">
                      {trainer.certifications.map((cert, i) => {
                        const c = cert as { name: string; url?: string };
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal px-3 py-1 shrink-0">
                              {c.name}
                            </Badge>
                            {c.url && (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1.5 truncate"
                              >
                                Verify
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {trainer.languages && trainer.languages.length > 0 && (
                  <section className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Languages className="h-5 w-5 text-muted-foreground" /> Languages
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {trainer.languages.map((lang, i) => (
                        <Badge key={i} variant="outline" className="font-normal px-3 py-1">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-8 mt-0 focus-visible:outline-none">
              {isVendor && !isTrainerSelf && (
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Leave a Review</CardTitle>
                    <CardDescription>Share your experience working with {trainer.name.split(' ')[0]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                            >
                              <Star className={`h-6 w-6 ${rating >= star ? 'fill-amber-500 text-amber-500' : 'text-muted'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="engagementTitle">Engagement Title (Optional)</Label>
                        <Input
                          id="engagementTitle"
                          placeholder="e.g. Advanced React Workshop"
                          value={engagementTitle}
                          onChange={(e) => setEngagementTitle(e.target.value)}
                          disabled={createReview.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="comment">Comment</Label>
                        <Textarea
                          id="comment"
                          placeholder="How was the training? What did they do well?"
                          rows={4}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          disabled={createReview.isPending}
                          required
                        />
                      </div>
                      <Button type="submit" disabled={createReview.isPending || !comment.trim()}>
                        {createReview.isPending ? "Submitting..." : "Submit Review"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-6">
                {reviewsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border bg-card">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-16 w-full mt-2" />
                      </div>
                    </div>
                  ))
                ) : reviews?.length ? (
                  reviews.map((review, i) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex gap-4">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={review.vendorLogoUrl} />
                          <AvatarFallback className="bg-muted text-muted-foreground">{review.vendorName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">{review.vendorName}</h4>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</span>
                          </div>
                          {review.engagementTitle && (
                            <p className="text-xs text-muted-foreground font-medium">{review.engagementTitle}</p>
                          )}
                          <div className="flex items-center gap-0.5 pt-1">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star key={idx} className={`h-3 w-3 ${idx < review.rating ? 'fill-amber-500 text-amber-500' : 'text-muted'}`} />
                            ))}
                          </div>
                          <p className="text-sm text-foreground mt-3 leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                    <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium">No reviews yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">This trainer hasn't received any reviews.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-lg">At a Glance</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{trainer.completedTrainings} Engagements</p>
                  <p className="text-xs text-muted-foreground">Successfully completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Availability</p>
                  <p className="text-xs text-muted-foreground">{trainer.availability || "Contact for availability"}</p>
                </div>
              </div>
              {(() => {
                const engaged = ((trainer as { engagedDates?: EngagedRange[] }).engagedDates ?? [])
                  .filter((r) => r?.endDate && r.endDate >= new Date().toISOString().slice(0, 10))
                  .sort((a, b) => a.startDate.localeCompare(b.startDate));
                return (
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Engaged Dates</p>
                      {engaged.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No upcoming engagements</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {engaged.slice(0, 5).map((r, idx) => {
                            let label = `${r.startDate} – ${r.endDate}`;
                            try {
                              label = `${format(new Date(r.startDate + "T00:00:00"), "MMM d")} – ${format(
                                new Date(r.endDate + "T00:00:00"),
                                "MMM d, yyyy",
                              )}`;
                            } catch {
                              // keep iso fallback
                            }
                            return (
                              <li key={`${r.startDate}-${r.endDate}-${idx}`} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{label}</span>
                                {r.note ? <span className="ml-1">· {r.note}</span> : null}
                              </li>
                            );
                          })}
                          {engaged.length > 5 && (
                            <li className="text-xs text-muted-foreground">+{engaged.length - 5} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          
          {trainer.portfolioUrl && (
            <Card>
              <CardContent className="p-6">
                <a href={trainer.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-primary hover:underline font-medium">
                  View Portfolio
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
