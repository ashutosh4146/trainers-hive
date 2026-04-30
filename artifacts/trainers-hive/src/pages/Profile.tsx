import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import {
  useGetCurrentUser,
  useGetVendor,
  useUpdateVendor,
  useGetTrainer,
  useUpdateTrainer,
  useListSkills,
  getGetVendorQueryKey,
  getGetTrainerQueryKey,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ShieldAlert,
  CalendarPlus,
  Trash2,
  CalendarDays,
  ChevronsUpDown,
  Check,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// =========================
// Vendor Form (unchanged)
// =========================

const vendorSchema = z.object({
  companyName: z.string().min(2),
  industry: z.string().min(2),
  location: z.string().min(2),
  contactName: z.string().min(2),
  contactDesignation: z.string().min(2),
  about: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

function VendorProfile({ vendorId }: { vendorId: string }) {
  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) },
  });
  const updateVendor = useUpdateVendor();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      companyName: "",
      industry: "",
      location: "",
      contactName: "",
      contactDesignation: "",
      about: "",
      websiteUrl: "",
    },
  });

  React.useEffect(() => {
    if (vendor) {
      form.reset({
        companyName: vendor.companyName || "",
        industry: vendor.industry || "",
        location: vendor.location || "",
        contactName: vendor.contactName || "",
        contactDesignation: vendor.contactDesignation || "",
        about: vendor.about || "",
        websiteUrl: vendor.websiteUrl || "",
      });
    }
  }, [vendor, form]);

  const onSubmit = (data: VendorFormValues) => {
    updateVendor.mutate(
      { id: vendorId, data },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your vendor profile has been saved." });
          queryClient.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) return <ProfileSkeleton />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Vendor Profile</CardTitle>
            <CardDescription>Manage your company's information and public presence.</CardDescription>
          </div>
          {vendor?.verified && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contactDesignation" render={({ field }) => (
                <FormItem><FormLabel>Contact Designation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem><FormLabel>Headquarters Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="websiteUrl" render={({ field }) => (
                <FormItem><FormLabel>Website URL</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <Label>Email Address (Read-only)</Label>
              <Input value={vendor?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Contact support to change your account email.</p>
            </div>

            <FormField control={form.control} name="about" render={({ field }) => (
              <FormItem>
                <FormLabel>About Company</FormLabel>
                <FormControl><Textarea rows={5} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateVendor.isPending}>
                {updateVendor.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ==========================================================
// Trainer form helpers: SkillCombobox, TagInput, CertEditor
// ==========================================================

type SkillOption = { value: string; group: string };

function SkillCombobox({
  value,
  onChange,
  options,
  placeholder = "Search or add a skill",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SkillOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of options) {
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group)!.push(o.value);
    }
    return Array.from(map.entries());
  }, [options]);

  const trimmed = query.trim();
  const exists = options.some((o) => o.value.toLowerCase() === trimmed.toLowerCase());
  const showCustomAdd = trimmed.length > 0 && !exists;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[320px]" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Type a skill name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!showCustomAdd && <CommandEmpty>No skill found.</CommandEmpty>}
            {showCustomAdd && (
              <CommandGroup heading="Add custom">
                <CommandItem
                  value={`__add__:${trimmed}`}
                  onSelect={() => {
                    onChange(trimmed);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{trimmed}" as a custom skill
                </CommandItem>
              </CommandGroup>
            )}
            {grouped.map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((s) => (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => {
                      onChange(s);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === s ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
  suggestions,
  maxTags = 30,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxTags?: number;
}) {
  const [draft, setDraft] = React.useState("");

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.length >= maxTags) return;
    if (value.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setDraft("");
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const draftTrim = draft.trim().toLowerCase();
  const matchingSuggestions = suggestions
    ?.filter(
      (s) =>
        s.toLowerCase().includes(draftTrim) &&
        !value.some((v) => v.toLowerCase() === s.toLowerCase()),
    )
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-md border bg-background">
        {value.map((tag, i) => (
          <Badge key={`${tag}-${i}`} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(i)}
              className="hover:bg-foreground/10 rounded-sm"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={value.length === 0 ? placeholder : ""}
        />
      </div>
      {draftTrim.length > 0 && matchingSuggestions && matchingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matchingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-xs px-2 py-1 rounded-md border hover:bg-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add. Backspace removes the last tag. Custom values allowed.
      </p>
    </div>
  );
}

type Cert = { name: string; url?: string };

function CertificationsEditor({
  value,
  onChange,
}: {
  value: Cert[];
  onChange: (next: Cert[]) => void;
}) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const { toast } = useToast();

  const handleAdd = () => {
    const n = name.trim();
    if (!n) {
      toast({ title: "Name required", description: "Enter the certification name first.", variant: "destructive" });
      return;
    }
    let u = url.trim() || undefined;
    if (u) {
      try {
        new URL(u);
      } catch {
        toast({ title: "Invalid URL", description: "Verification link is not a valid URL.", variant: "destructive" });
        return;
      }
    }
    onChange([...value, u ? { name: n, url: u } : { name: n }]);
    setName("");
    setUrl("");
  };

  const handleRemove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label htmlFor="cert-name">Certification name</Label>
          <Input
            id="cert-name"
            placeholder="e.g. AWS Solutions Architect"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cert-url">Verification URL or file link (optional)</Label>
          <Input
            id="cert-url"
            type="url"
            placeholder="https://verify.acme.com/abc or Drive link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <Button type="button" onClick={handleAdd} variant="outline">
          <Plus className="h-4 w-4 mr-2" /> Add
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
          No certifications added yet.
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {value.map((c, idx) => (
            <li key={`${c.name}-${idx}`} className="flex items-center justify-between p-3 gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate max-w-full"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.url}</span>
                  </a>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${c.name}`}
                onClick={() => handleRemove(idx)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =========================
// Trainer Form (redesigned)
// =========================

const trainerSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  mainSkill: z.string().min(1, "Pick or add a primary skill"),
  experienceYears: z.coerce.number().int().min(0).max(80),
  developmentExperienceYears: z.coerce.number().int().min(0).max(80),
  location: z.string().min(2, "Location is required"),
  bio: z.string().optional(),
  trainerType: z.enum(["trainer", "developer", "both"]).optional(),
  resumeUrl: z.string().url("Resume URL must be a valid link").optional().or(z.literal("")),
});

type TrainerFormValues = z.infer<typeof trainerSchema>;

function TrainerProfile({ trainerId, registeredEmail }: { trainerId: string; registeredEmail: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const { data: skillsData } = useListSkills();
  const updateTrainer = useUpdateTrainer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tag/array state lives outside the form because react-hook-form is awkward
  // with array primitives. We submit them along with form values.
  const [subSkills, setSubSkills] = React.useState<string[]>([]);
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [certifications, setCertifications] = React.useState<Cert[]>([]);

  const form = useForm<TrainerFormValues>({
    resolver: zodResolver(trainerSchema),
    defaultValues: {
      name: "",
      mainSkill: "",
      experienceYears: 0,
      developmentExperienceYears: 0,
      location: "",
      bio: "",
      trainerType: undefined,
      resumeUrl: "",
    },
  });

  React.useEffect(() => {
    if (trainer) {
      const t = trainer as typeof trainer & {
        developmentExperienceYears?: number;
        trainerType?: "trainer" | "developer" | "both";
        resumeUrl?: string;
        certifications?: Cert[];
      };
      form.reset({
        name: t.name || "",
        mainSkill: t.mainSkill || "",
        experienceYears: t.experienceYears ?? 0,
        developmentExperienceYears: t.developmentExperienceYears ?? 0,
        location: t.location || "",
        bio: t.bio || "",
        trainerType: t.trainerType,
        resumeUrl: t.resumeUrl || "",
      });
      setSubSkills(t.subSkills ?? []);
      setLanguages(t.languages ?? []);
      setCertifications(Array.isArray(t.certifications) ? t.certifications : []);
    }
  }, [trainer, form]);

  // Build skill options from skill taxonomy
  const skillOptions: SkillOption[] = React.useMemo(() => {
    const opts: SkillOption[] = [];
    for (const cat of skillsData ?? []) {
      for (const s of cat.skills) opts.push({ value: s, group: cat.name });
    }
    return opts;
  }, [skillsData]);

  const allSkillNames = React.useMemo(
    () => skillOptions.map((o) => o.value),
    [skillOptions],
  );

  // Languages suggestion list — keep small for UX; user can type their own.
  const languageSuggestions = React.useMemo(
    () => [
      "English",
      "Hindi",
      "Tamil",
      "Telugu",
      "Bengali",
      "Marathi",
      "Kannada",
      "Malayalam",
      "Gujarati",
      "Punjabi",
      "Spanish",
      "French",
      "German",
      "Mandarin",
      "Arabic",
    ],
    [],
  );

  const onSubmit = (data: TrainerFormValues) => {
    const payload = {
      ...data,
      subSkills,
      languages,
      certifications,
      // empty resumeUrl → omit (server treats "" as no-op due to validation
      // skipping the URL check, but we send undefined to avoid storing "")
      resumeUrl: data.resumeUrl ? data.resumeUrl : undefined,
    };

    updateTrainer.mutate(
      { id: trainerId, data: payload },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your trainer profile has been saved." });
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: (err) => {
          const anyErr = err as { response?: { data?: { error?: string } } };
          toast({
            title: "Could not save profile",
            description: anyErr?.response?.data?.error ?? "Please check your inputs and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) return <ProfileSkeleton />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Trainer Profile</CardTitle>
            <CardDescription>Manage your professional identity and public profile.</CardDescription>
          </div>
          {trainer?.verified && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 1. Full name */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl><Input {...field} placeholder="As you'd like it shown to vendors" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* 2. Registered email (read-only) */}
            <div className="space-y-2">
              <Label>Registered email</Label>
              <Input value={registeredEmail} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Your account email cannot be changed here. Contact support to update it.
              </p>
            </div>

            {/* 3. Primary skill + sub-skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="mainSkill" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary skill</FormLabel>
                  <FormControl>
                    <SkillCombobox
                      value={field.value || ""}
                      onChange={field.onChange}
                      options={skillOptions}
                      placeholder="Type to search, or add custom"
                    />
                  </FormControl>
                  <FormDescription>Type the first letters and select; if not found, add a custom one.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormItem>
                <FormLabel>Sub-skills</FormLabel>
                <TagInput
                  value={subSkills}
                  onChange={setSubSkills}
                  placeholder="Type a skill and press Enter"
                  suggestions={allSkillNames}
                />
              </FormItem>
            </div>

            {/* 4. Years of experience: training + development */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="experienceYears" render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of training experience</FormLabel>
                  <FormControl><Input type="number" min={0} max={80} {...field} /></FormControl>
                  <FormDescription>Years you've spent training others in your domain.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="developmentExperienceYears" render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of development experience</FormLabel>
                  <FormControl><Input type="number" min={0} max={80} {...field} /></FormControl>
                  <FormDescription>Hands-on years building or working with this technology.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* 5 + 10. Location and trainer type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input {...field} placeholder="City, Country" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="trainerType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Are you a full-time trainer or developer?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select your primary engagement" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trainer">Full-time trainer</SelectItem>
                      <SelectItem value="developer">Full-time developer</SelectItem>
                      <SelectItem value="both">Both — trainer and developer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* 6. Languages */}
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <TagInput
                value={languages}
                onChange={setLanguages}
                placeholder="e.g. English, Hindi"
                suggestions={languageSuggestions}
              />
            </FormItem>

            {/* 7. Certifications */}
            <FormItem>
              <FormLabel>Certifications</FormLabel>
              <FormDescription>
                Add each certification's name and a link to verify it (or a shareable link to the certificate file).
              </FormDescription>
              <CertificationsEditor value={certifications} onChange={setCertifications} />
            </FormItem>

            {/* 8. Resume URL */}
            <FormField control={form.control} name="resumeUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Resume link (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="Paste a Google Drive, Dropbox, or any shareable link to your resume"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Paste a publicly accessible link. (File upload coming soon.)</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* 9. About / bio */}
            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel>Tell us more about you</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder="Share your background, training style, and the kinds of engagements you enjoy..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateTrainer.isPending}>
                {updateTrainer.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// =====================================
// Trainer Availability (Engaged Dates)
// =====================================

type EngagedRange = { startDate: string; endDate: string; note?: string };

function TrainerAvailability({ trainerId }: { trainerId: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const updateTrainer = useUpdateTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [note, setNote] = React.useState("");

  const engaged: EngagedRange[] = React.useMemo(() => {
    const raw = (trainer as { engagedDates?: EngagedRange[] } | undefined)?.engagedDates;
    return Array.isArray(raw) ? raw : [];
  }, [trainer]);

  const sorted = React.useMemo(
    () => [...engaged].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [engaged],
  );

  const persist = (next: EngagedRange[]) => {
    updateTrainer.mutate(
      { id: trainerId, data: { engagedDates: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not save your availability", variant: "destructive" });
        },
      },
    );
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) {
      toast({ title: "Pick both dates", description: "Start and end dates are required.", variant: "destructive" });
      return;
    }
    if (end < start) {
      toast({ title: "Invalid range", description: "End date must be on or after start date.", variant: "destructive" });
      return;
    }
    const next: EngagedRange[] = [
      ...engaged,
      { startDate: start, endDate: end, ...(note.trim() ? { note: note.trim() } : {}) },
    ];
    persist(next);
    setStart("");
    setEnd("");
    setNote("");
  };

  const handleRemove = (idx: number) => {
    const next = engaged.filter((_, i) => i !== idx);
    persist(next);
  };

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Set availability — engaged dates</CardTitle>
            <CardDescription>
              Mark the dates you're already booked. Vendors will see these, and you won't be able to apply to
              requirements that overlap with these dates.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="engaged-start">Start date</Label>
            <Input
              id="engaged-start"
              type="date"
              value={start}
              min={todayIso}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="engaged-end">End date</Label>
            <Input
              id="engaged-end"
              type="date"
              value={end}
              min={start || todayIso}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <Label htmlFor="engaged-note">Note (optional)</Label>
            <Input
              id="engaged-note"
              placeholder="e.g. Acme Corp training"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
            />
          </div>
          <Button type="submit" disabled={updateTrainer.isPending} className="md:w-auto">
            <CalendarPlus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </form>

        <div className="space-y-2">
          <div className="text-sm font-medium">Your booked periods</div>
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/30">
              No engaged dates yet. You're shown as available for all upcoming requirements.
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {sorted.map((r, idx) => {
                const realIdx = engaged.indexOf(r);
                let label = `${r.startDate} → ${r.endDate}`;
                try {
                  label = `${format(new Date(r.startDate + "T00:00:00"), "MMM d, yyyy")} → ${format(
                    new Date(r.endDate + "T00:00:00"),
                    "MMM d, yyyy",
                  )}`;
                } catch {
                  // keep iso fallback
                }
                return (
                  <li key={`${r.startDate}-${r.endDate}-${idx}`} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium text-sm">{label}</div>
                      {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(realIdx)}
                      disabled={updateTrainer.isPending}
                      aria-label="Remove engaged dates"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================
// Common Components
// =========================

function ProfileSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-8 w-1/3 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl"><ProfileSkeleton /></div>;
  }

  if (!user) {
    return <div className="container mx-auto px-4 py-20 text-center">Please log in.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-1 capitalize">Manage your {user.role} identity.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {user.role === "vendor" && user.vendorId && <VendorProfile vendorId={user.vendorId} />}
        {user.role === "trainer" && user.trainerId && (
          <>
            <TrainerProfile trainerId={user.trainerId} registeredEmail={user.email} />
            <TrainerAvailability trainerId={user.trainerId} />
          </>
        )}
        {user.role === "admin" && (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-bold mb-2">Admin Profile</h2>
              <p className="text-muted-foreground max-w-md">
                Administrative profiles are managed centrally via the enterprise identity provider. Profile editing is disabled in this environment.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
