import React from "react";
import { Link } from "wouter";
import { useGetSkillsDemand } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SkillsDemand() {
  const { data: skillDemand, isLoading } = useGetSkillsDemand();

  const maxCount = skillDemand && skillDemand.length > 0 ? skillDemand[0]!.count : 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Skills in Demand</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
          A live snapshot of the skills most requested by organisations posting on Trainers Hive.
          Use this to understand market demand, compare it with your own expertise, and spot gaps you could fill.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">All Skills — Ranked by Open Requirements</CardTitle>
          <CardDescription>Only open (active) requirements are counted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32 shrink-0" />
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-4 w-10 shrink-0" />
                </div>
              ))}
            </div>
          ) : !skillDemand || skillDemand.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="mx-auto h-8 w-8 mb-3 opacity-30" />
              <p className="font-medium">No open requirements yet</p>
              <p className="text-sm mt-1">Check back once vendors start posting requirements.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {skillDemand.map((item, index) => {
                const widthPct = Math.max(4, Math.round((item.count / maxCount) * 100));
                return (
                  <div key={item.skill} className="flex items-center gap-3 group">
                    <div className="w-6 text-right text-xs text-muted-foreground font-mono shrink-0">
                      {index + 1}
                    </div>
                    <div className="w-36 text-sm font-medium truncate shrink-0" title={item.skill}>
                      {item.skill}
                    </div>
                    <div className="flex-1 relative h-7 bg-muted rounded overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-semibold text-primary">{item.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        {item.count === 1 ? "req" : "reqs"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Data refreshes in real time as requirements are posted or closed.
        This page is publicly accessible — share it with your network.
      </p>
    </div>
  );
}
