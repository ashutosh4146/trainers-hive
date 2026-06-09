import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  customFetch,
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
  Mail,
  MapPin,
  Phone,
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
import { TrainerExperienceExtrasRows } from "@/components/TrainerExperienceExtrasRows";

type Cert = { name: string; url?: string };
type TrainerExtras = {
  mobileNumber?: string;
  dateOfBirth?: string;
  workPermit?: string;
  locality?: string;
  fullAddress?: string;
  [key: string]: unknown;
};
type ProfileExtrasResponse = { avatarUrl?: string; profileExtras?: TrainerExtras };

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Urdu",
  "Odia",
  "Assamese",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Japanese",
  "Mandarin",
];

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

function LanguagePicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = React.useState("");
  const cleanQuery = query.trim();
  const suggestions = React.useMemo(() => {
    if (cleanQuery.length < 2) return [];
    const lower = cleanQuery.toLowerCase();
    return LANGUAGE_OPTIONS.filter((language) => language.toLowerCase().includes(lower) && !value.some((selected) => selected.toLowerCase() === language.toLowerCase())).slice(0, 6);
  }, [cleanQuery, value]);

  const addLanguage = (language: string) => {
    const clean = language.trim();
    if (clean.length < 2) return;
    if (value.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setQuery("");
      return;
    }
    const fullMatch = LANGUAGE_OPTIONS.find((item) => item.toLowerCase() === clean.toLowerCase()) || LANGUAGE_OPTIONS.find((item) => item.toLowerCase().startsWith(clean.toLowerCase()));
    onChange([...value, fullMatch || clean]);
    setQuery("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLanguage(suggestions[0] || query);
            }
          }}
          placeholder="Type 2 letters, e.g. en, hi, ma"
        />
        <Button type="button" variant="outline" onClick={() => addLanguage(suggestions[0] || query)} disabled={cleanQuery.length < 2}>Add</Button>
      </div>
      {suggestions.length > 0 && <div className="flex flex-wrap gap-2">{suggestions.map((language) => <button key={language} type="button" onClick={() => addLanguage(language)} className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">{language}</button>)}</div>}
      <div className="flex min-h-10 flex-wrap gap-2 rounded-xl border bg-background p-2">
        {value.length === 0 ? <span className="px-2 py-1 text-sm text-muted-foreground">No languages added yet</span> : value.map((language) => <Badge key={language} variant="secondary" className="gap-1 rounded-full px-3 py-1">{language}<button type="button" onClick={() => onChange(value.filter((item) => item !== language))} aria-label={`Remove ${language}`}><X className="h-3 w-3" /></button></Badge>)}
      </div>
      <p className="text-xs text-muted-foreground">Start typing at least 2 letters to see full language suggestions, then click Add.</p>
    </div>
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
      {value.length > 0 && <div className="space-y-2">{value.map((cert, index) => <div key={`${cert.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{cert.name}</p>{cert.url && <a href={cert.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> View proof</a>}</div><Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove certification"><X className="h-4 w-4" /></Button></div>)}</div>}
    </div>
  );
}

export function TrainerProfilePolishPage({ trainerId, registeredEmail }: { trainerId: string; registeredEmail: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, { query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) } });
  const { data: skillsData } = useListSkills();
  const { data: user } = useGetCurrentUser();
  const updateTrainer = useUpdateTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [subSkillsText, setSubSkillsText] = React.useState("");
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [certifications, setCertifications] = React.useState<Cert[]>([]);
  const [mobileNumber, setMobileNumber] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [workPermit, setWorkPermit] = React.useState("");
  const [locality, setLocality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [profileExtras, setProfileExtras] = React.useState<TrainerExtras>({});
  const [avatarUrl, setAvatarUrl] = React.useState("");

  const form = useForm<TrainerFormValues>({
    resolver: zodResolver(trainerSchema),
    defaultValues: { name: "", headline: "", mainSkill: "", experienceYears: 0, developmentExperienceYears: 0, location: "", bio: "", trainerType: undefined as unknown as "trainer" | "developer" | "both", resumeUrl: "" },
  });

  React.useEffect(() => {
    if (!trainer) return;
    form.reset({ name: trainer.name || "", headline: trainer.headline || "", mainSkill: trainer.mainSkill || "", experienceYears: trainer.experienceYears ?? 0, developmentExperienceYears: trainer.developmentExperienceYears ?? 0, location: trainer.location || "", bio: trainer.bio || "", trainerType: trainer.trainerType as "trainer" | "developer" | "both" | undefined, resumeUrl: trainer.resumeUrl || "" });
    setSubSkillsText(joinTags(trainer.subSkills));
    setLanguages(Array.isArray(trainer.languages) ? trainer.languages : []);
    setCertifications(Array.isArray(trainer.certifications) ? trainer.certifications : []);
  }, [trainer, form]);

  React.useEffect(() => {
    if (!trainerId) return;
    customFetch<ProfileExtrasResponse>(`/api/trainers/${trainerId}/profile-extras`).then((data) => {
      const extras = data.profileExtras ?? {};
      setProfileExtras(extras);
      setMobileNumber(extras.mobileNumber ?? "");
      setDateOfBirth(extras.dateOfBirth ?? "");
      setWorkPermit(extras.workPermit ?? "");
      setLocality(extras.locality ?? "");
      setFullAddress(extras.fullAddress ?? "");
      setAvatarUrl(data.avatarUrl ?? "");
    }).catch(() => {});
  }, [trainerId]);

  const watched = form.watch();
  const subSkills = splitTags(subSkillsText);
  const skillSuggestions = React.useMemo(() => {
    const items: string[] = [];
    for (const group of skillsData ?? []) for (const skill of group.skills) items.push(skill);
    return items.slice(0, 300);
  }, [skillsData]);
  const completionItems = [
    { label: "Full name", done: !!watched.name?.trim(), helper: "Shown on applications and profile cards." },
    { label: "Primary skill", done: !!watched.mainSkill?.trim(), helper: "Improves requirement matching." },
    { label: "Location", done: !!watched.location?.trim(), helper: "Helps vendors plan delivery and travel." },
    { label: "Mobile number", done: !!mobileNumber.trim(), helper: "Helps coordination after hiring." },
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
    updateTrainer.mutate({ id: trainerId, data: { ...data, headline: (data.headline ?? "").trim(), resumeUrl: (data.resumeUrl ?? "").trim(), subSkills, languages, certifications } }, {
      onSuccess: async () => {
        const nextExtras = { ...profileExtras, mobileNumber: mobileNumber.trim(), dateOfBirth, workPermit: workPermit.trim(), locality: locality.trim(), fullAddress: fullAddress.trim() };
        setProfileExtras(nextExtras);
        try {
          await customFetch(`/api/trainers/${trainerId}/profile-extras`, { method: "PATCH", body: JSON.stringify({ avatarUrl, profileExtras: nextExtras }) });
        } catch {
          toast({ title: "Profile saved, but contact extras were not updated", variant: "destructive" });
        }
        toast({ title: "Profile updated", description: "Your trainer profile has been saved." });
        queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      },
      onError: (err) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        toast({ title: "Could not save profile", description: anyErr?.response?.data?.error ?? "Please check your inputs and try again.", variant: "destructive" });
      },
    });
  };

  if (isLoading) return <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8"><Skeleton className="h-40 rounded-2xl" /><div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]"><Skeleton className="h-[720px] rounded-2xl" /><Skeleton className="h-[720px] rounded-2xl" /></div></div>;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section id="profile-overview" className="scroll-mt-24 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Trainer profile</Badge>{trainer?.verified ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Verified</Badge> : <Badge variant="outline">Verification pending</Badge>}</div><h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{watched.name || user?.name || "Your profile"}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Polish your trainer profile, skills, resume, certifications, and availability so vendors can evaluate you faster.</p></div>
          <div className="rounded-2xl border bg-background/80 p-4 text-center shadow-sm lg:min-w-[180px]"><p className="text-xs font-medium text-muted-foreground">Profile strength</p><p className="mt-1 text-3xl font-bold text-primary">{score}%</p><p className="mt-1 text-xs text-muted-foreground">{completed} of {completionItems.length} complete</p></div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><MetricCard label="Primary skill" value={watched.mainSkill || "Not set"} helper="Used for matching and search." icon={<GraduationCap className="h-5 w-5" />} /><MetricCard label="Languages" value={languages.length} helper="Training languages added." icon={<Languages className="h-5 w-5" />} /><MetricCard label="Experience" value={`${Number(watched.experienceYears ?? 0)}y`} helper="Years of training experience." icon={<BriefcaseBusiness className="h-5 w-5" />} /></div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card id="profile-contact" className="scroll-mt-24 border-primary/10">
            <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Contact and personal details</CardTitle><CardDescription>Name, email, phone, headline, location, and address live in one place.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Full name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="As shown to vendors" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="headline" render={({ field }) => <FormItem><FormLabel>Profile headline</FormLabel><FormControl><Input {...field} value={field.value ?? ""} maxLength={140} placeholder="e.g. AWS and Python trainer for corporate teams" /></FormControl><FormDescription>Appears under your name on cards.</FormDescription><FormMessage /></FormItem>} />
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary" /> Registered email</Label><Input value={registeredEmail} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">Contact support to update this email.</p></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-primary" /> Mobile number</Label><Input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="+91..." /><p className="text-xs text-muted-foreground">Used for coordination after hiring.</p></div>
                <FormField control={form.control} name="location" render={({ field }) => <FormItem><FormLabel className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Location <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="City, Country" /></FormControl><FormMessage /></FormItem>} />
                <div className="space-y-2"><Label>Locality</Label><Input value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Mansarovar, Jaipur" /><p className="text-xs text-muted-foreground">Area or neighborhood for better coordination.</p></div>
                <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>
                <div className="space-y-2"><Label>Work permit</Label><Input value={workPermit} onChange={(event) => setWorkPermit(event.target.value)} placeholder="India, UAE, US H1B, etc." /></div>
                <div className="space-y-2 md:col-span-2"><Label>Full address</Label><Textarea rows={3} value={fullAddress} onChange={(event) => setFullAddress(event.target.value)} placeholder="Full address for internal coordination" /></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
            <Card id="profile-professional" className="scroll-mt-24 border-primary/10">
              <CardHeader><CardTitle>Professional details</CardTitle><CardDescription>Skills, languages, delivery type, and profile bio.</CardDescription></CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4"><div><h3 className="text-sm font-semibold">Skills and delivery</h3><p className="mt-1 text-xs text-muted-foreground">Add your main skill, sub-skills, languages, and engagement type.</p></div><div className="grid gap-6 md:grid-cols-2"><FormField control={form.control} name="mainSkill" render={({ field }) => <FormItem><FormLabel>Primary skill <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} list="trainer-skill-suggestions" placeholder="Type or choose a skill" /></FormControl><datalist id="trainer-skill-suggestions">{skillSuggestions.map((skill) => <option key={skill} value={skill} />)}</datalist><FormMessage /></FormItem>} /><FormField control={form.control} name="trainerType" render={({ field }) => <FormItem><FormLabel>Primary engagement <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Select your primary engagement" /></SelectTrigger></FormControl><SelectContent><SelectItem value="trainer">Full-time trainer</SelectItem><SelectItem value="developer">Full-time developer</SelectItem><SelectItem value="both">Both — trainer and developer</SelectItem></SelectContent></Select><FormMessage /></FormItem>} /><div className="space-y-2 md:col-span-2"><Label>Sub-skills</Label><Input value={subSkillsText} onChange={(event) => setSubSkillsText(event.target.value)} placeholder="AWS, Lambda, SageMaker, Python" /><p className="text-xs text-muted-foreground">Separate skills with commas.</p></div><div className="space-y-2 md:col-span-2"><Label>Languages <span className="text-destructive">*</span></Label><LanguagePicker value={languages} onChange={setLanguages} /></div></div></div>
                <FormField control={form.control} name="bio" render={({ field }) => <FormItem><FormLabel>Trainer bio</FormLabel><FormControl><Textarea rows={6} placeholder="Share your background, training style, learner audience, and projects you enjoy." {...field} /></FormControl><FormMessage /></FormItem>} />
              </CardContent>
            </Card>
            <div className="space-y-6"><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> Profile preview</CardTitle><CardDescription>How vendors understand your profile.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl border bg-primary/5 p-4"><p className="font-semibold">{watched.name || "Your name"}</p><p className="mt-1 text-sm text-muted-foreground">{watched.headline || "Add a profile headline"}</p><div className="mt-3 flex flex-wrap gap-1.5">{watched.mainSkill && <Badge variant="outline">{watched.mainSkill}</Badge>}{watched.trainerType && <Badge variant="outline" className="capitalize">{watched.trainerType}</Badge>}{watched.location && <Badge variant="outline">{watched.location}</Badge>}</div></div><div className="grid gap-3 text-sm"><div className="flex items-center gap-3 rounded-xl border p-3"><Code2 className="h-4 w-4 text-primary" /><span className="truncate">{subSkills.length ? subSkills.join(", ") : "Sub-skills not set"}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><Globe2 className="h-4 w-4 text-primary" /><span className="truncate">{languages.length ? languages.join(", ") : "Languages not set"}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><Phone className="h-4 w-4 text-primary" /><span className="truncate">{mobileNumber || "Mobile number not set"}</span></div><div className="flex items-center gap-3 rounded-xl border p-3"><Award className="h-4 w-4 text-primary" /><span className="truncate">{certifications.length} certification{certifications.length === 1 ? "" : "s"}</span></div></div></CardContent></Card><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Completion checklist</CardTitle><CardDescription>Complete these for better vendor response.</CardDescription></CardHeader><CardContent className="space-y-2">{completionItems.map((item) => <CompletionTile key={item.label} {...item} />)}</CardContent></Card></div>
          </div>
          <Card id="profile-experience" className="scroll-mt-24 border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" /> Experience and proof</CardTitle><CardDescription>Training depth, development background, employment, education, resume, and certificates in one section.</CardDescription></CardHeader><CardContent className="space-y-6"><div className="grid gap-6 md:grid-cols-2"><FormField control={form.control} name="experienceYears" render={({ field }) => <FormItem><FormLabel>Training experience</FormLabel><FormControl><Input type="number" min={0} max={80} {...field} /></FormControl><FormDescription>Years spent training others.</FormDescription><FormMessage /></FormItem>} /><FormField control={form.control} name="developmentExperienceYears" render={({ field }) => <FormItem><FormLabel>Development experience</FormLabel><FormControl><Input type="number" min={0} max={80} {...field} /></FormControl><FormDescription>Hands-on years building or working with technology.</FormDescription><FormMessage /></FormItem>} /><FormField control={form.control} name="resumeUrl" render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Resume URL optional</FormLabel><FormControl><Input type="url" inputMode="url" placeholder="https://drive.google.com/..." {...field} value={field.value ?? ""} /></FormControl><FormDescription>Paste a public resume link.</FormDescription><FormMessage /></FormItem>} /></div><div className="space-y-2"><Label>Certifications</Label><CertEditor value={certifications} onChange={setCertifications} /></div><TrainerExperienceExtrasRows trainerId={trainerId} /><div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Saved changes update your trainer profile immediately.</p><Button type="submit" disabled={updateTrainer.isPending}>{updateTrainer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{updateTrainer.isPending ? "Saving..." : "Save trainer profile"}</Button></div></CardContent></Card>
        </form>
      </Form>
      <div id="profile-availability" className="scroll-mt-24"><TrainerAvailabilityPolish trainerId={trainerId} /></div>
    </div>
  );
}
