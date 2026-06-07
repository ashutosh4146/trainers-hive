import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getGetCurrentUserQueryKey, getGetVendorQueryKey, useGetVendor, useUpdateVendor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, ClipboardCheck, FileText, Globe2, Loader2, Mail, MapPin, ShieldAlert, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const vendorSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  industry: z.string().trim().min(2, "Industry is required"),
  location: z.string().trim().min(2, "Headquarters location is required"),
  contactName: z.string().trim().min(2, "Contact person is required"),
  contactDesignation: z.string().trim().min(2, "Designation is required"),
  about: z.string().trim().min(40, "Add at least 40 characters about your company"),
  websiteUrl: z.string().trim().url("Enter a valid website URL"),
});

type VendorFormValues = z.infer<typeof vendorSchema>;
type Item = { label: string; done: boolean; helper: string };

function done(value?: string, min = 2) {
  return (value ?? "").trim().length >= min;
}

function LoadingShell() {
  return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]"><Skeleton className="h-[720px] rounded-2xl" /><Skeleton className="h-[720px] rounded-2xl" /></div></div>;
}

function MetricCard({ title, value, helper, icon }: { title: string; value: React.ReactNode; helper: string; icon: React.ReactNode }) {
  return <Card className="border-primary/10"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold leading-none">{value}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span></div></CardContent></Card>;
}

function RequiredRow({ item }: { item: Item }) {
  return <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3 text-sm"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-medium">{item.label}</p><Badge variant="outline" className="px-1.5 py-0 text-[10px] text-destructive">Required</Badge></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.helper}</p></div>{item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <span className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Pending</span>}</div>;
}

export function VendorProfileRequired({ vendorId }: { vendorId: string }) {
  const { data: vendor, isLoading } = useGetVendor(vendorId, { query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) } });
  const updateVendor = useUpdateVendor();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { companyName: "", industry: "", location: "", contactName: "", contactDesignation: "", about: "", websiteUrl: "" },
  });

  React.useEffect(() => {
    if (!vendor) return;
    form.reset({
      companyName: vendor.companyName || "",
      industry: vendor.industry || "",
      location: vendor.location || "",
      contactName: vendor.contactName || "",
      contactDesignation: vendor.contactDesignation || "",
      about: vendor.about || "",
      websiteUrl: vendor.websiteUrl || "",
    });
  }, [vendor, form]);

  const values = form.watch();
  const aboutLength = values.about?.trim().length ?? 0;
  const website = (values.websiteUrl || "").trim();
  const items: Item[] = [
    { label: "Company name", done: done(values.companyName), helper: "Used as your public organization identity." },
    { label: "Industry", done: done(values.industry), helper: "Helps trainers understand your domain." },
    { label: "Headquarters location", done: done(values.location), helper: "Shows where your company is based." },
    { label: "Contact person", done: done(values.contactName), helper: "Primary person for trainer coordination." },
    { label: "Contact designation", done: done(values.contactDesignation), helper: "Adds credibility to the contact person." },
    { label: "Website", done: done(values.websiteUrl, 8), helper: "A valid company URL improves verification readiness." },
    { label: "Company summary", done: done(values.about, 40), helper: "Minimum 40 characters about company and training needs." },
  ];
  const complete = items.filter((item) => item.done).length;
  const score = Math.round((complete / items.length) * 100);
  const missing = items.length - complete;

  const onSubmit = (data: VendorFormValues) => {
    updateVendor.mutate({ id: vendorId, data }, {
      onSuccess: () => {
        toast({ title: "Profile updated", description: "Your vendor profile has been saved." });
        queryClient.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to update profile", variant: "destructive" }),
    });
  };

  if (isLoading) return <LoadingShell />;

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 md:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Vendor profile</Badge>{vendor?.verified ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verified by Trainers Hive</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><ShieldAlert className="mr-1 h-3.5 w-3.5" /> Verification pending</Badge>}{missing === 0 ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Ready</Badge> : <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">{missing} required missing</Badge>}</div><h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{values.companyName || vendor?.companyName || "Vendor workspace"}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Complete the required company, contact, website, and summary details so trainers can evaluate your requirements with confidence.</p></div><div className="rounded-2xl border bg-background/80 p-4 text-center shadow-sm lg:min-w-[180px]"><p className="text-xs font-medium text-muted-foreground">Profile strength</p><p className="mt-1 text-3xl font-bold text-primary">{score}%</p><p className="mt-1 text-xs text-muted-foreground">{complete} of {items.length} complete</p></div></div></section>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><MetricCard title="Required details" value={`${complete}/${items.length}`} helper="Complete all required fields before scaling hiring." icon={<ClipboardCheck className="h-5 w-5" />} /><MetricCard title="Verification" value={vendor?.verified ? "Verified" : "Pending"} helper="Verification helps trainers trust your posted requirements." icon={<ShieldCheck className="h-5 w-5" />} /><MetricCard title="Public preview" value={website ? "Live" : "Incomplete"} helper="Website and summary make the profile more credible." icon={<Sparkles className="h-5 w-5" />} /></div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]"><Card className="border-primary/10"><CardHeader><CardTitle>Company details</CardTitle><CardDescription>Required details are marked with *. These are used across requirements, applicant views, and trust signals.</CardDescription></CardHeader><CardContent><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8"><div className="space-y-4"><div><h3 className="text-sm font-semibold">Company identity</h3><p className="mt-1 text-xs text-muted-foreground">Tell trainers who you are and where you operate from.</p></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FormField control={form.control} name="companyName" render={({ field }) => <FormItem><FormLabel>Company name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="e.g. Acme Learning Solutions" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="industry" render={({ field }) => <FormItem><FormLabel>Industry <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="e.g. EdTech, Corporate L&D" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel>Headquarters location <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="City, Country" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="websiteUrl" render={({ field }) => <FormItem><FormLabel>Website URL <span className="text-destructive">*</span></FormLabel><FormControl><Input type="url" inputMode="url" placeholder="https://www.yourcompany.com" {...field} onBlur={(event) => { let val = event.target.value.trim(); if (val && !val.startsWith("http://") && !val.startsWith("https://")) { val = "https://" + (val.startsWith("www.") ? val : "www." + val); field.onChange(val); } field.onBlur(); }} /></FormControl><FormDescription>Use an official company website when possible.</FormDescription><FormMessage /></FormItem>} /></div></div>

    <div className="space-y-4"><div><h3 className="text-sm font-semibold">Primary coordination contact</h3><p className="mt-1 text-xs text-muted-foreground">This helps applicants know who is responsible for trainer communication.</p></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FormField control={form.control} name="contactName" render={({ field }) => <FormItem><FormLabel>Contact person <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="Hiring or L&D contact" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="contactDesignation" render={({ field }) => <FormItem><FormLabel>Designation <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="e.g. Training Manager" /></FormControl><FormMessage /></FormItem>} /></div><div className="space-y-2"><Label>Registered email</Label><Input value={vendor?.email || ""} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">Contact support to change your account email.</p></div></div>

    <FormField control={form.control} name="about" render={({ field }) => <FormItem><FormLabel>About company <span className="text-destructive">*</span></FormLabel><FormControl><Textarea rows={7} placeholder="Describe your company, training needs, learner audience, engagement style, and what trainers can expect when working with you." {...field} /></FormControl><FormDescription>{aboutLength}/40 minimum characters. Include company background, training categories, and trainer expectations.</FormDescription><FormMessage /></FormItem>} />

    <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Saved changes update your vendor profile immediately.</p><Button type="submit" disabled={updateVendor.isPending}>{updateVendor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{updateVendor.isPending ? "Saving..." : "Save vendor profile"}</Button></div></form></Form></CardContent></Card>

    <div className="space-y-6"><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Profile preview</CardTitle><CardDescription>How your company may appear to trainer applicants.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl border bg-primary/5 p-4"><div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span><div className="min-w-0"><p className="truncate font-semibold">{values.companyName || "Company name"}</p><p className="mt-1 text-sm text-muted-foreground">{values.industry || "Industry"}</p><div className="mt-2 flex flex-wrap gap-1.5">{vendor?.verified && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Verified</Badge>}{values.location && <Badge variant="outline">{values.location}</Badge>}</div></div></div>{values.about ? <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-muted-foreground">{values.about}</p> : <p className="mt-4 rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">Add a company summary to make this preview stronger.</p>}</div><div className="grid grid-cols-1 gap-3 text-sm"><div className="flex items-center gap-3 rounded-xl border p-3"><MapPin className="h-4 w-4 text-primary" /><span className="truncate">{values.location || "Location not set"}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><UserRound className="h-4 w-4 text-primary" /><span className="truncate">{values.contactName || "Contact not set"}{values.contactDesignation ? ` · ${values.contactDesignation}` : ""}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><Mail className="h-4 w-4 text-primary" /><span className="truncate">{vendor?.email || "Email not available"}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><Globe2 className="h-4 w-4 text-primary" />{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">{website.replace(/^https?:\/\//, "")}</a> : <span className="text-muted-foreground">Website not set</span>}</div></div></CardContent></Card><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Required details</CardTitle><CardDescription>Complete every required item for a professional vendor profile.</CardDescription></CardHeader><CardContent className="space-y-2">{items.map((item) => <RequiredRow key={item.label} item={item} />)}</CardContent></Card><Card className="border-primary/10"><CardHeader><CardTitle>Verification readiness</CardTitle><CardDescription>Use this checklist before asking for verification review.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><div className="rounded-xl border p-3">Official company name and website should match.</div><div className="rounded-xl border p-3">Contact person should be reachable and relevant to training decisions.</div><div className="rounded-xl border p-3">Company summary should mention training needs and target learners.</div><div className="rounded-xl border p-3">Post clear requirements after saving the profile.</div></CardContent></Card></div></div>
  </div>;
}
