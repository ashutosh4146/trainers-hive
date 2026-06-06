import React from "react";
import { Link } from "wouter";
import { CheckCircle2, Circle, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CompletionItem = {
  key: string;
  label: string;
  done: boolean;
};

function percent(items: CompletionItem[]) {
  if (items.length === 0) return 0;
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

export function getTrainerCompletionItems(trainer: any): CompletionItem[] {
  return [
    { key: "name", label: "Name", done: !!trainer?.name?.trim?.() },
    { key: "skill", label: "Primary skill", done: !!trainer?.mainSkill?.trim?.() },
    { key: "location", label: "Location", done: !!trainer?.location?.trim?.() },
    { key: "type", label: "Trainer type", done: !!trainer?.trainerType },
    { key: "bio", label: "Professional bio", done: !!trainer?.bio?.trim?.() || !!trainer?.about?.trim?.() },
    { key: "languages", label: "Languages", done: Array.isArray(trainer?.languages) && trainer.languages.length > 0 },
    { key: "skills", label: "Additional skills", done: Array.isArray(trainer?.subSkills) && trainer.subSkills.length > 0 },
    { key: "certifications", label: "Certifications", done: Array.isArray(trainer?.certifications) && trainer.certifications.length > 0 },
  ];
}

export function getVendorCompletionItems(vendor: any): CompletionItem[] {
  return [
    { key: "company", label: "Company name", done: !!vendor?.companyName?.trim?.() },
    { key: "industry", label: "Industry", done: !!vendor?.industry?.trim?.() },
    { key: "location", label: "Location", done: !!vendor?.location?.trim?.() },
    { key: "contact", label: "Contact person", done: !!vendor?.contactName?.trim?.() },
    { key: "designation", label: "Contact designation", done: !!vendor?.contactDesignation?.trim?.() },
    { key: "about", label: "Company overview", done: !!vendor?.about?.trim?.() },
    { key: "website", label: "Website", done: !!vendor?.websiteUrl?.trim?.() },
  ];
}

export function ProfileCompletion({
  title = "Profile completion",
  description = "Complete your profile to improve trust and matching quality.",
  items,
  ctaHref = "/profile",
  className,
}: {
  title?: string;
  description?: string;
  items: CompletionItem[];
  ctaHref?: string;
  className?: string;
}) {
  const score = percent(items);
  const missing = items.filter((item) => !item.done);

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserRoundCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{score}%</p>
          <p className="text-[11px] text-muted-foreground">complete</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <Button asChild size="sm" className="mt-4">
          <Link href={ctaHref}>Complete missing details</Link>
        </Button>
      )}
    </div>
  );
}
