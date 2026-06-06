import React from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  useGetRequirement,
  useGetRequirementAiMatches,
  getGetRequirementQueryKey,
  getGetRequirementAiMatchesQueryKey,
} from "@workspace/api-client-react";
import { ArrowRight, BadgeCheck, MapPin, Sparkles, Star, TrendingUp } from "lucide-react";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function requirementIdFromPath(path: string) {
  const match = path.match(/^\/requirements\/([^/?#]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return decodeURIComponent(match[1]);
}

function scoreForRank(index: number) {
  return Math.max(72, 96 - index * 5);
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent fit";
  if (score >= 82) return "Strong fit";
  return "Good fit";
}

function scoreTone(score: number) {
  if (score >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (score >= 82) return "bg-primary/10 text-primary";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

export function RequirementMatchInsights() {
  const [location] = useLocation();
  const requirementId = requirementIdFromPath(location);
  const { data: user } = useGetCurrentUser();
  const isAllowed = !!requirementId && (user?.role === "vendor" || user?.role === "admin");

  const { data: requirement } = useGetRequirement(requirementId ?? "", {
    query: {
      enabled: isAllowed,
      queryKey: getGetRequirementQueryKey(requirementId ?? ""),
    },
  });

  const isOwnerOrAdmin = user?.role === "admin" || (user?.role === "vendor" && requirement?.vendorId === user.vendorId);

  const { data: matches, isLoading } = useGetRequirementAiMatches(requirementId ?? "", {
    query: {
      enabled: !!requirementId && !!isOwnerOrAdmin,
      queryKey: getGetRequirementAiMatchesQueryKey(requirementId ?? ""),
    },
  });

  if (!requirementId || !isOwnerOrAdmin) return null;
  if (!isLoading && (!matches || matches.length === 0)) return null;

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <h2 className="font-semibold">Matching score insights</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-ranked trainers for this requirement, with fit quality and decision signals.
              </p>
            </div>
            <div className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:block">
              {matches?.length ?? 0} matches
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border bg-background/70 p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="mt-3 h-2 w-full" />
                  <Skeleton className="mt-3 h-3 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {(matches ?? []).slice(0, 3).map((match, index) => {
                const score = scoreForRank(index);
                return (
                  <div key={match.trainerId} className="rounded-xl border bg-background/80 p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <TrainerAvatar name={match.name} avatarUrl={match.avatarUrl} className="h-10 w-10" />
                        <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">{match.name}</p>
                          {match.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{match.mainSkill}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-2xl font-bold text-primary">{score}%</div>
                        <div className={cn("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", scoreTone(score))}>
                          {scoreLabel(score)}
                        </div>
                      </div>
                      <div className="space-y-1 text-right text-xs text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {match.rating.toFixed(1)} rating
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {match.experienceYears}y exp
                        </div>
                        {match.location && (
                          <div className="flex items-center justify-end gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="max-w-[120px] truncate">{match.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                    </div>

                    {match.subSkills && match.subSkills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {match.subSkills.slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 line-clamp-2 text-xs italic text-muted-foreground">“{match.reason}”</p>

                    <Button asChild variant="outline" size="sm" className="mt-3 h-8 w-full gap-1 text-xs">
                      <Link href={`/trainers/${match.trainerId}`}>
                        View profile <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
