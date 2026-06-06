import React from "react";
import { CheckCircle2, Circle, FileSignature, Handshake, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "submitted", label: "Applied" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "hired", label: "Selected" },
  { key: "agreement", label: "Agreement" },
  { key: "completed", label: "Completed" },
];

function getStepIndex(status: string, hasAgreement?: boolean) {
  if (status === "completed") return 4;
  if (hasAgreement) return 3;
  if (status === "hired") return 2;
  if (status === "shortlisted") return 1;
  if (status === "submitted" || status === "applied") return 0;
  return -1;
}

export function ApplicationPipeline({
  status,
  hasAgreement = false,
  compact = false,
  className,
}: {
  status: string;
  hasAgreement?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (status === "rejected" || status === "withdrawn") {
    return (
      <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <XCircle className="h-4 w-4" />
          {status === "rejected" ? "Not selected" : "Withdrawn"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">This application is no longer active.</p>
      </div>
    );
  }

  const activeIndex = getStepIndex(status, hasAgreement);

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Application pipeline</p>
            <p className="text-xs text-muted-foreground">Track progress from application to completion.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary capitalize">
            {status === "submitted" ? "applied" : status}
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {STEPS.map((step, index) => {
          const done = activeIndex >= index;
          const Icon = step.key === "agreement" ? FileSignature : step.key === "hired" ? Handshake : done ? CheckCircle2 : Circle;
          return (
            <div key={step.key} className="min-w-0">
              <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : "bg-muted")} />
              <div className="mt-2 flex flex-col items-center text-center">
                <span className={cn("mb-1 flex h-7 w-7 items-center justify-center rounded-full border", done ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className={cn("truncate text-[11px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
