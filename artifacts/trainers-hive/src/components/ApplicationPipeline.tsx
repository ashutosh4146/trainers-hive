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

function getStatusGuidance(status: string, hasAgreement?: boolean) {
  if (status === "completed") return "Training is completed. Keep final notes and closure updates here.";
  if (hasAgreement) return "Agreement is in progress. Confirm delivery details and next milestones.";
  if (status === "hired") return "You were selected for this requirement. Confirm kickoff, dates, and deliverables.";
  if (status === "shortlisted") return "You are shortlisted. Keep availability and final plan ready.";
  if (status === "submitted" || status === "applied") return "Application submitted. Wait for vendor review or send a concise follow-up from Messages.";
  return "Track this application as it moves from review to completion.";
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
    const label = status === "rejected" ? "Not selected" : "Withdrawn";
    const guidance = status === "rejected" ? "This application is closed and kept for reference." : "This application was withdrawn and is no longer active.";

    return (
      <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <XCircle className="h-4 w-4" />
          {label}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{guidance}</p>
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
          const current = activeIndex === index;
          const Icon = step.key === "agreement" ? FileSignature : step.key === "hired" ? Handshake : done ? CheckCircle2 : Circle;
          return (
            <div key={step.key} className="min-w-0">
              <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : "bg-muted")} />
              <div className="mt-2 flex flex-col items-center text-center">
                <span className={cn("mb-1 flex h-7 w-7 items-center justify-center rounded-full border", done ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground", current && "ring-2 ring-primary/20")}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className={cn("truncate text-[11px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                {current && !compact && <span className="mt-0.5 text-[10px] text-primary">Current</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {getStatusGuidance(status, hasAgreement)}
        </div>
      )}
    </div>
  );
}
