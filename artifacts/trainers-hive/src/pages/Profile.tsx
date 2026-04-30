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
  getGetCurrentUserQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ShieldAlert, CalendarPlus, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

// --- Vendor Form ---

const vendorSchema = z.object({
  companyName: z.string().min(2),
  industry: z.string().min(2),
  location: z.string().min(2),
  contactName: z.string().min(2),
  contactDesignation: z.string().min(2),
  about: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
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
        }
      }
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

// --- Trainer Form ---

const trainerSchema = z.object({
  name: z.string().min(2),
  headline: z.string().min(5),
  mainSkill: z.string().min(1),
  subSkills: z.string(), // comma separated string
  experienceYears: z.coerce.number().min(0),
  location: z.string().min(2),
  remote: z.boolean(),
  hourlyRate: z.coerce.number().min(1),
  bio: z.string().optional(),
  availability: z.string().optional(),
});

type TrainerFormValues = z.infer<typeof trainerSchema>;

function TrainerProfile({ trainerId }: { trainerId: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const { data: skillsData } = useListSkills();
  const updateTrainer = useUpdateTrainer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TrainerFormValues>({
    resolver: zodResolver(trainerSchema),
    defaultValues: {
      name: "",
      headline: "",
      mainSkill: "",
      subSkills: "",
      experienceYears: 0,
      location: "",
      remote: false,
      hourlyRate: 0,
      bio: "",
      availability: "",
    },
  });

  React.useEffect(() => {
    if (trainer) {
      form.reset({
        name: trainer.name || "",
        headline: trainer.headline || "",
        mainSkill: trainer.mainSkill || "",
        subSkills: trainer.subSkills?.join(", ") || "",
        experienceYears: trainer.experienceYears || 0,
        location: trainer.location || "",
        remote: trainer.remote || false,
        hourlyRate: trainer.hourlyRate || 0,
        bio: trainer.bio || "",
        availability: trainer.availability || "",
      });
    }
  }, [trainer, form]);

  const onSubmit = (data: TrainerFormValues) => {
    const subSkillsArray = data.subSkills.split(",").map(s => s.trim()).filter(Boolean);
    
    updateTrainer.mutate(
      { id: trainerId, data: { ...data, subSkills: subSkillsArray } },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Your trainer profile has been saved." });
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
        }
      }
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="headline" render={({ field }) => (
                <FormItem><FormLabel>Professional Headline</FormLabel><FormControl><Input placeholder="e.g. Senior Frontend Engineer & Trainer" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="mainSkill" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Skill</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select primary skill" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {skillsData?.map((cat) => (
                        <SelectGroup key={cat.id}>
                          <SelectLabel>{cat.name}</SelectLabel>
                          {cat.skills.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="subSkills" render={({ field }) => (
                <FormItem><FormLabel>Sub-skills (comma separated)</FormLabel><FormControl><Input placeholder="React, Node.js, AWS" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="experienceYears" render={({ field }) => (
                <FormItem><FormLabel>Years of Experience</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                <FormItem><FormLabel>Hourly Rate ($)</FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="availability" render={({ field }) => (
                <FormItem><FormLabel>Availability Status</FormLabel><FormControl><Input placeholder="e.g. Available starting next month" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="remote" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5"><FormLabel className="text-base">Remote Work</FormLabel><FormDescription>Available for remote training engagements</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem><FormLabel>Biography</FormLabel><FormControl><Textarea rows={5} placeholder="Tell vendors about your background and teaching style..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {/* Read-only sections for demo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <Label>Certifications (Read-only)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {trainer?.certifications?.map((cert, i) => <Badge key={i} variant="secondary">{cert}</Badge>) || <span className="text-sm text-muted-foreground">None listed</span>}
                </div>
              </div>
              <div>
                <Label>Languages (Read-only)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {trainer?.languages?.map((lang, i) => <Badge key={i} variant="outline">{lang}</Badge>) || <span className="text-sm text-muted-foreground">None listed</span>}
                </div>
              </div>
            </div>

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

// --- Trainer Availability (Engaged Dates) ---

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
            <CardTitle>Engaged Dates</CardTitle>
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

// --- Common Components ---

function ProfileSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-8 w-1/3 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>)}
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
        {user.role === 'vendor' && user.vendorId && <VendorProfile vendorId={user.vendorId} />}
        {user.role === 'trainer' && user.trainerId && (
          <>
            <TrainerProfile trainerId={user.trainerId} />
            <TrainerAvailability trainerId={user.trainerId} />
          </>
        )}
        {user.role === 'admin' && (
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
