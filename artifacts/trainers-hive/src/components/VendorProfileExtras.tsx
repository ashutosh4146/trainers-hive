import React from "react";
import { Building2, CheckCircle2, ClipboardCheck, FileText, Globe2, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type VendorProfileValues = {
  companyName?: string;
  industry?: string;
  location?: string;
  contactName?: string;
  contactDesignation?: string;
  about?: string;
  websiteUrl?: string;
};

type VendorProfileExtrasProps = {
  values: VendorProfileValues;
  email?: string;
  verified?: boolean;
};

function isDone(value?: string, min = 1) {
  return (value ?? "").trim().length >= min;
}

function StatusRow({ label, helper, done }: { label: string; helper: string; done: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-destructive">Required</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </div>
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <span className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Pending</span>}
    </div>
  );
}

export function getVendorRequiredItems(values: VendorProfileValues) {
  return [
    { label: "Company name", done: isDone(values.companyName, 2), helper: "Used as your public organization identity." },
    { label: "Industry", done: isDone(values.industry, 2), helper: "Helps trainers understand your domain." },
    { label: "Headquarters location", done: isDone(values.location, 2), helper: "Shows where your company is based." },
    { label: "Contact person", done: isDone(values.contactName, 2), helper: "Primary person for trainer coordination." },
    { label: "Contact designation", done: isDone(values.contactDesignation, 2), helper: "Adds credibility to the contact person." },
    { label: "Website", done: isDone(values.websiteUrl, 8), helper: "A valid company URL improves verification readiness." },
    { label: "Company summary", done: isDone(values.about, 40), helper: "Minimum 40 characters about company and training needs." },
  ];
}

export function VendorProfileExtras({ values, email, verified }: VendorProfileExtrasProps) {
  const items = getVendorRequiredItems(values);
  const completed = items.filter((item) => item.done).length;
  const website = (values.websiteUrl ?? "").trim();

  return (
    <div className="space-y-6">
      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Profile preview</CardTitle>
          <CardDescription>How your company may appear to trainer applicants.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{values.companyName || "Company name"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{values.industry || "Industry"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {verified && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Verified</Badge>}
                  {values.location && <Badge variant="outline">{values.location}</Badge>}
                </div>
              </div>
            </div>
            {values.about ? <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{values.about}</p> : <p className="mt-4 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">Add a company summary to make this preview stronger.</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl border p-3"><MapPin className="h-4 w-4 text-primary" /><span className="truncate">{values.location || "Location not set"}</span></div>
            <div className="flex items-center gap-3 rounded-xl border p-3"><UserRound className="h-4 w-4 text-primary" /><span className="truncate">{values.contactName || "Contact not set"}{values.contactDesignation ? ` · ${values.contactDesignation}` : ""}</span></div>
            <div className="flex items-center gap-3 rounded-xl border p-3"><Mail className="h-4 w-4 text-primary" /><span className="truncate">{email || "Email not available"}</span></div>
            <div className="flex items-center gap-3 rounded-xl border p-3"><Globe2 className="h-4 w-4 text-primary" />{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">{website.replace(/^https?:\/\//, "")}</a> : <span className="text-muted-foreground">Website not set</span>}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Required details</CardTitle>
          <CardDescription>{completed} of {items.length} required profile details complete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => <StatusRow key={item.label} {...item} />)}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Verification readiness</CardTitle>
          <CardDescription>Use this before requesting verification review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="rounded-xl border p-3"><ClipboardCheck className="mr-2 inline h-4 w-4 text-primary" /> Company name and website should match.</div>
          <div className="rounded-xl border p-3"><ClipboardCheck className="mr-2 inline h-4 w-4 text-primary" /> Contact person should handle trainer coordination.</div>
          <div className="rounded-xl border p-3"><ClipboardCheck className="mr-2 inline h-4 w-4 text-primary" /> Company summary should mention training needs.</div>
          <div className="rounded-xl border p-3"><ClipboardCheck className="mr-2 inline h-4 w-4 text-primary" /> Post clear requirements after saving the profile.</div>
        </CardContent>
      </Card>
    </div>
  );
}
