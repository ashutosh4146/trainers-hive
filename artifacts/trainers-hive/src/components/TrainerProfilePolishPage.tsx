import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  getGetCurrentUserQueryKey,
  getGetTrainerQueryKey,
  useGetCurrentUser,
  useGetTrainer,
  useListSkills,
  useUpdateTrainer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  ExternalLink,
  Globe2,
  GraduationCap,
  Languages,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TrainerAvailabilityPolish } from "@/components/TrainerAvailabilityPolish";

type Cert = { name: string; url?: string };

const trainerSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  headline: z.string().trim().max(140, "Headline must be 140 characters or less").optional(),
  mainSkill: z.string().min(1, "Primary skill is required"),
  experienceYears: z.coerce.number().int().min(0).max(80),
  developmentExperienceYears: z.coerce.number().int().min(0).max(80),
  location: z.string().min(2, "Location is required"),
  bio: z.string().optional(),
  trainerType: z.enum(["trainer", "developer", "both"], {
    required_error: "Please select your primary engagement type",
    invalid_type_error: "Please select your primary engagement type",
  }),
  resumeUrl: z.string().trim().url("Enter a valid URL").max(2000, "URL is too long").or(z.literal("")).optional(),
});

type TrainerFormValues = z.infer<typeof trainerSchema>;

function splitTags(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function joinTags(value?: string[]) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function CompletionTile({ label, done, helper }: { label: string; done: boolean; helper: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </div>
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <span className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Pending</span>}
    </div>
  );
}

function MetricCard({ label, value, helper, icon }: { label: string; value: React.ReactNode; helper: string; icon: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CertEditor({ value, onChange }: { value: Cert[]; onChange: (next: Cert[]) => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const { toast } = useToast();

  const add = () => {
    const cleanName = name.trim();
    const cleanUrl = url.trim();
    if (!cleanName) {
      toast({ title: "Certification name required", variant: "destructive" });
      return;
    }
    if (cleanUrl) {
      try { new URL(cleanUrl); } catch {
        toast({ title: "Invalid URL", description: "Use a valid certificate link or leave it blank.", variant: "destructive" });
        return;
      }
    }
    onChange([...value, { name: cleanName, ...(cleanUrl ? { url: cleanUrl } : {}) }]);
    setName("");
    setUrl("");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Certification name" />
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Verification link optional" />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((cert, index) => (
            <div key={`${cert.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{cert.name}</p>
                {cert.url && <a href={cert.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> View proof</a>}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove certification">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrainerProfilePolishPage({ trainerId, registeredEmail }: { trainerId: string; registeredEmail: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const { data: skillsData } = useListSkills();
  const { data: user } = useGetCurrentUser();
  const updateTrainer = useUpdateTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [subSkillsText, setSubSkillsText] = React.useState("");
  const [languagesText, setLanguagesText] = React.useState("");
  const [certifications, setCertifications] = React.useState<Cert[]>([]);

  const form = useForm<TrainerFormValues>({
    resolver: zodResolver(trainerSchema),
    defaultValues: {
      name: "",
      headline: "",
      mainSkill: "",
      experienceYears: 0,
      developmentExperienceYears: 0,
      location: "",
      bio: "",
      trainerType: undefined as unknown as "trainer" | "developer" | "both",
      resumeUrl: "",
    },
  });

  React.useEffect(() => {
    if (!trainer) return;
    form.reset({
      name: trainer.name || "",
      headline: trainer.headline || "",
      mainSkill: trainer.mainSkill || "",
      experienceYears: trainer.experienceYears ?? 0,
      developmentExperienceYears: trainer.developmentExperienceYears ?? 0,
      location: trainer.location || "",
      bio: trainer.bio || "",
      trainerType: trainer.trainerType as "trainer" | "developer" | "both" | undefined,
      resumeUrl: trainer.resumeUrl || "",
    });
    setSubSkillsText(joinTags(trainer.subSkills));
    setLanguagesText(joinTags(trainer.languages));
    setCertifications(Array.isArray(trainer.certifications) ? trainer.certifications : []);
  }, [trainer, form]);

  const watched = form.watch();
  const subSkills = splitTags(subSkillsText);
  const languages = splitTags(languagesText);
  const skillSuggestions = React.useMemo(() => {
    const items: string[] = [];
    for (const group of skillsData ?? []) {
      for (const skill of group.skills) items.push(skill);
    }
    return items.slice(0, 300);
  }, [skillsData]);

  const completionItems = [
    { label: "Full name", done: !!watched.name?.trim(), helper: "Shown on applications and profile cards." },
    { label: "Primary skill", done: !!watched.mainSkill?.trim(), helper: "Improves requirement matching." },
    { label: "Location", done: !!watched.location?.trim(), helper: "Helps vendors plan delivery and travel." },
    { label: "Languages", done: languages.length > 0, helper: "At least one training language is required." },
    { label: "Engagement type", done: !!watched.trainerType, helper: "Clarifies whether you train, develop, or both." },
    { label: "Profile headline", done: !!watched.headline?.trim(), helper: "A short line improves profile conversion." },
  ];
  const completed = completionItems.filter((item) => item.done).length;
  const score = Math.round((completed / completionItems.length) * 100);

  const onSubmit = (data: TrainerFormValues) => {
    if (languages.length === 0) {
      toast({ title: "Language required", description: "Add at least one language you train in.", variant: "destructive" });
      return;
    }

    updateTrainer.mutate(
      {
        id: trainerId,
        data: {
          ...data,
          headline: (data.headline ?? "").trim(),
          resumeUrl: (data.resumeUrl ?? "").trim(),
          subSkills,
          languages,
          certifications,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your trainer profile has been saved." });
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: (err) => {
          const anyErr = err as { response?: { data?: { error?: string } } };
          toast({ title: "Could not save profile", description: anyErr?.response?.data?.error ?? "Please check your inputs and try again.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]"><Skeleton className="h-[720px] rounded-2xl" /><Skeleton className="h-[720px] rounded-2xl" /></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Trainer profile</Badge>
              {trainer?.verified ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Verified</Badge> : <Badge variant="outline">Verification pending</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{watched.name || user?.name || "Your profile"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Polish your trainer profile, skills, resume, certifications, and availability so vendors can evaluate you faster.</p>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4 text-center shadow-sm lg:min-w-[180px]">
            <p className="text-xs font-medium text-muted-foreground">Profile strength</p>
            <p className="mt-1 text-3xl font-bold text-primary">{score}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{completed} of {completionItems.length} complete</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Primary skill" value={watched.mainSkill || "Not set"} helper="Used for matching and search." icon={<GraduationCap className="h-5 w-5" />} />
        <MetricCard label="Languages" value={languages.length} helper="Training languages added." icon={<Languages className="h-5 w-5" />} />
        <MetricCard label="Experience" value={`${Number(watched.experienceYears ?? 0)}y`} helper="Years of training experience." icon={<BriefcaseBusiness className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <Card className="border-primary/10">
          <CardHeader><CardTitle>Professional details</CardTitle><CardDescription>Required fields are used for applications, matching, and vendor review.</CardDescription></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-4">
                  <div><h3 className="text-sm font-semibold">Identity</h3><p className="mt-1 text-xs text-muted-foreground">Your name, headline, email, and location.</p></div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Full name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="As shown to vendors" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="headline" render={({ field }) => <FormItem><FormLabel>Profile headline</FormLabel><FormControl><Input {...field} value={field.value ?? ""} maxLength={140} placeholder="e.g. AWS and Python trainer for corporate teams" /></FormControl><FormDescription>Appears under your name on cards.</FormDescription><FormMessage /></FormItem>} />
                    <div className="space-y-2"><Label>Registered email</Label><Input value={registeredEmail} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">Contact support to update this email.</p></div>
                    <FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel>Location <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="City, Country" /></FormControl><FormMessage /></FormItem>} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div><h3 className="text-sm font-semibold">Skills and delivery</h3><p className="mt-1 text-xs text-muted-foreground">Add your main skill, sub-skills, languages, and engagement type.</p></div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="mainSkill" render={({ field }) => <FormItem><FormLabel>Primary skill <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} list="trainer-skill-suggestions" placeholder="Type or choose a skill" /></FormControl><datalist id="trainer-skill-suggestions">{skillSuggestions.map((skill) => <option key={skill} value={skill} />)}</datalist><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="trainerType" render={({ field }) => <FormItem><FormLabel>Primary engagement <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Select your primary engagement" /></SelectTrigger></FormControl><SelectContent><SelectItem value="trainer">Full-time trainer</SelectItem><SelectItem value="developer">Full-time developer</SelectItem><SelectItem value="both">Both — trainer and developer</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
                    <div className="space-y-2 md:col-span-2"><Label>Sub-skills</Label><Input value={subSkillsText} onChange={(event) => setSubSkillsText(event.target.value)} placeholder="AWS, Lambda, SageMaker, Python" /><p className="text-xs text-muted-foreground">Separate skills with commas.</p></div>
                    <div className="space-y-2 md:col-span-2"><Label>Languages <span className="text-destructive">*</span></Label><Input value={languagesText} onChange={(event) => setLanguagesText(event.target.value)} placeholder="English, Hindi" /><p className="text-xs text-muted-foreground">Separate languages with commas.</p></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div><h3 className="text-sm font-semibold">Experience and proof</h3><p className="mt-1 text-xs text-muted-foreground">Show training depth, development background, certifications, and resume.</p></div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="experienceYears" render={({ field }) => <FormItem><FormLabel>Training experience</FormLabel><FormControl><Input type="number" min={0} max={80} {...field} /></FormControl><FormDescription>Years spent training others.</FormDescription><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="developmentExperienceYears" render={({ field }) => <FormItem><FormLabel>Development experience</FormLabel><FormControl><Input type="number" min={0} max={80} {...field} /></FormControl><FormDescription>Hands-on years building or working with technology.</FormDescription><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="resumeUrl" render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Resume URL optional</FormLabel><FormControl><Input type="url" inputMode="url" placeholder="https://drive.google.com/..." {...field} value={field.value ?? ""} /></FormControl><FormDescription>Paste a public resume link.</FormDescription><FormMessage /></FormItem>} />
                  </div>
                  <div className="space-y-2"><Label>Certifications</Label><CertEditor value={certifications} onChange={setCertifications} /></div>
                </div>

                <FormField control={form.control} name="bio" render={({ field }) => <FormItem><FormLabel>Trainer bio</FormLabel><FormControl><Textarea rows={6} placeholder="Share your background, training style, learner audience, and projects you enjoy." {...field} /></FormControl><FormMessage /></FormItem>} />

                <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Saved changes update your trainer profile immediately.</p>
                  <Button type="submit" disabled={updateTrainer.isPending}>{updateTrainer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{updateTrainer.isPending ? "Saving..." : "Save trainer profile"}</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> Profile preview</CardTitle><CardDescription>How vendors understand your profile.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-primary/5 p-4">
                <p className="font-semibold">{watched.name || "Your name"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{watched.headline || "Add a profile headline"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{watched.mainSkill && <Badge variant="outline">{watched.mainSkill}</Badge>}{watched.trainerType && <Badge variant="outline" className="capitalize">{watched.trainerType}</Badge>}{watched.location && <Badge variant="outline">{watched.location}</Badge>}</div>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3 rounded-xl border p-3"><Code2 className="h-4 w-4 text-primary" /><span className="truncate">{subSkills.length ? subSkills.join(", ") : "Sub-skills not set"}</span></div>
                <div className="flex items-center gap-3 rounded-xl border p-3"><Globe2 className="h-4 w-4 text-primary" /><span className="truncate">{languages.length ? languages.join(", ") : "Languages not set"}</span></div>
                <div className="flex items-center gap-3 rounded-xl border p-3"><Award className="h-4 w-4 text-primary" /><span className="truncate">{certifications.length} certification{certifications.length === 1 ? "" : "s"}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Completion checklist</CardTitle><CardDescription>Complete these for better vendor response.</CardDescription></CardHeader>
            <CardContent className="space-y-2">{completionItems.map((item) => <CompletionTile key={item.label} {...item} />)}</CardContent>
          </Card>
        </div>
      </div>

      <TrainerAvailabilityPolish trainerId={trainerId} />
    </div>
  );
}
