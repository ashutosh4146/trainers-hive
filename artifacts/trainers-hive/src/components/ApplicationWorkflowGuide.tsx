import React from "react";

const STEPS = ["Applied", "Shortlisted", "Selected", "Agreement", "Completed"] as const;

export function ApplicationWorkflowGuide() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">Application workflow</h3>
      <p className="mt-1 text-sm text-muted-foreground">Follow each application from first contact to closure.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {STEPS.map((label, index) => (
          <div key={label} className="rounded-lg border bg-background p-3 text-center">
            <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </div>
            <p className="text-sm font-medium">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
