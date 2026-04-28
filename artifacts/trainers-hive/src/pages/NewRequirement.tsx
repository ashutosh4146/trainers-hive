import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateRequirement,
  useListSkills,
  useGetCurrentUser,
  useListRequirements,
  getListRequirementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  Wifi,
  MapPin,
  LayoutGrid,
  Clock,
  IndianRupee,
  MessageCircle,
  Briefcase,
  BookOpen,
  Users,
  Globe,
  Navigation,
  Gift,
  Car,
  BedDouble,
  XCircle,
  Copy,
  CheckCircle2,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { SubSkillTagInput } from "@/components/SubSkillTagInput";

const TRAINING_TYPES = [
  { value: "technical", label: "Technical / IT" },
  { value: "soft-skills", label: "Soft Skills / Behavioral" },
  { value: "leadership", label: "Leadership & Management" },
  { value: "sales", label: "Sales & Marketing" },
  { value: "compliance", label: "Safety & Compliance" },
  { value: "domain", label: "Domain / Industry-Specific" },
  { value: "other", label: "Other" },
];

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

const requirementSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  skill: z.string().min(1, "Please select a primary skill"),
  subSkills: z.string(),
  trainingType: z.string().min(1, "Please select a training type"),
  trainingMode: z.enum(["remote", "in-person", "hybrid"], {
    required_error: "Please select a delivery mode",
  }),
  location: z.string().optional(),
  trainerCount: z.coerce.number().min(1, "At least 1 trainer required"),
  trainerType: z.enum(["part-time", "full-time", "mentor"], {
    required_error: "Please select an engagement type",
  }),
  trainerScope: z.enum(["local", "pan-india"], {
    required_error: "Please select trainer reach",
  }),
  benefits: z.enum(["ta-da", "stay-only", "none"], {
    required_error: "Please select benefits",
  }),
  payoutChoice: z.enum(["discuss", "reveal"]).default("discuss"),
  budget: z.coerce.number().min(0).optional(),
  feeType: z.enum(["fixed", "negotiable"]).optional(),
  startDate: z.string().optional(),
  durationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
  deadline: z.string().min(1, "Application deadline is required"),
  description: z
    .string()
    .min(1, "Description is required")
    .refine((val) => countWords(val) >= 35, {
      message: "Description must be at least 35 words",
    }),
  certifications: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof requirementSchema>;

interface IconCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
}

function IconCard({ selected, onClick, icon, label, sub }: IconCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all cursor-pointer w-full",
        selected
          ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400"
          : "border-border bg-background hover:border-teal-300 hover:bg-muted/50 text-muted-foreground",
      )}
    >
      <span className={cn("text-2xl", selected ? "text-teal-600" : "")}>
        {icon}
      </span>
      <span>{label}</span>
      {sub && <span className="text-xs opacity-70">{sub}</span>}
    </button>
  );
}

export default function NewRequirement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: skillsData } = useListSkills();
  const createRequirement = useCreateRequirement();

  const vendorId = user?.vendorId ?? undefined;
  const { data: previousRequirements } = useListRequirements(
    { vendorId },
    { query: { enabled: !!vendorId } },
  );

  const allSkillSuggestions: string[] = skillsData
    ? skillsData.flatMap((cat) => cat.skills)
    : [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLoading, setFileLoading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    try {
      let text = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        text = await file.text();
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then((p) => p.getTextContent()),
          ),
        );
        text = pages
          .flatMap((page) => page.items.map((item: any) => item.str))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        toast({ title: "Unsupported file", description: "Please upload a .txt or .pdf file.", variant: "destructive" });
        return;
      }
      form.setValue("description", text, { shouldValidate: true });
      toast({ title: "File loaded", description: "Description filled from your file." });
    } catch {
      toast({ title: "Failed to read file", description: "Could not extract text. Try copy-pasting instead.", variant: "destructive" });
    } finally {
      setFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      title: "",
      skill: "",
      subSkills: "",
      trainingType: "",
      trainingMode: undefined,
      location: "",
      trainerCount: 1,
      trainerType: undefined,
      trainerScope: undefined,
      benefits: undefined,
      payoutChoice: "discuss",
      budget: undefined,
      feeType: "negotiable",
      startDate: "",
      durationDays: 30,
      deadline: "",
      description: "",
      certifications: "",
      language: "",
    },
  });

  const trainingMode = form.watch("trainingMode");
  const payoutChoice = form.watch("payoutChoice");
  const descriptionValue = form.watch("description");
  const wordCount = countWords(descriptionValue || "");

  useEffect(() => {
    if (!selectedTemplate || !previousRequirements) return;
    const template = previousRequirements.find((r) => r.id === selectedTemplate);
    if (!template) return;

    form.reset({
      title: template.title,
      skill: template.skill,
      subSkills: (template.subSkills ?? []).join(", "),
      trainingType: (template as any).trainingType ?? "",
      trainingMode:
        ((template as any).trainingMode as FormValues["trainingMode"]) ??
        (template.remote ? "remote" : "in-person"),
      location: template.location ?? "",
      trainerCount: (template as any).trainerCount ?? 1,
      trainerType:
        ((template as any).trainerType as FormValues["trainerType"]) ??
        undefined,
      trainerScope:
        ((template as any).trainerScope as FormValues["trainerScope"]) ??
        undefined,
      benefits:
        ((template as any).benefits as FormValues["benefits"]) ?? undefined,
      payoutChoice: (template as any).budget > 0 ? "reveal" : "discuss",
      budget: (template as any).budget > 0 ? (template as any).budget : undefined,
      feeType: ((template as any).feeType as FormValues["feeType"]) ?? "negotiable",
      startDate: (template as any).startDate ?? "",
      durationDays: template.durationDays,
      deadline: template.deadline
        ? new Date(template.deadline).toISOString().split("T")[0]
        : "",
      description: "",
      certifications: (template as any).certifications ?? "",
      language: (template as any).language ?? "",
    });

    toast({
      title: "Template loaded",
      description: "Fields filled from your previous post. Update as needed.",
    });
  }, [selectedTemplate]);

  const onSubmit = (data: FormValues) => {
    const subSkillsArray = data.subSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createRequirement.mutate(
      {
        data: {
          title: data.title,
          skill: data.skill,
          subSkills: subSkillsArray,
          trainingType: data.trainingType,
          trainingMode: data.trainingMode,
          location: data.location || undefined,
          trainerCount: data.trainerCount,
          trainerType: data.trainerType,
          trainerScope: data.trainerScope,
          benefits: data.benefits,
          ...(data.payoutChoice === "reveal" && data.budget
            ? { budget: data.budget, feeType: data.feeType ?? "negotiable" }
            : {}),
          startDate: data.startDate || undefined,
          durationDays: data.durationDays,
          deadline: new Date(data.deadline).toISOString(),
          description: data.description,
          certifications: data.certifications || undefined,
          language: data.language || undefined,
        },
      },
      {
        onSuccess: (newReq) => {
          toast({
            title: "Requirement posted!",
            description: "Trainers can now discover and apply.",
          });
          queryClient.invalidateQueries({
            queryKey: getListRequirementsQueryKey(),
          });
          setLocation(`/requirements/${newReq.id}`);
        },
        onError: () => {
          toast({
            title: "Failed to post",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (userLoading)
    return (
      <div className="container py-12 text-muted-foreground">Loading…</div>
    );

  if (user?.role !== "vendor") {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Vendor Access Required</h2>
        <p className="text-muted-foreground mb-6">
          Only verified vendors can post training requirements.
        </p>
        <Link href="/requirements">
          <Button variant="outline">Browse Requirements</Button>
        </Link>
      </div>
    );
  }

  const hasPrevious = !!previousRequirements && previousRequirements.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/requirements"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Requirements
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          Post a Training Requirement
        </h1>
        <p className="text-muted-foreground mt-1">
          Describe what you need — trainers will reach out to connect.
        </p>
      </div>

      {hasPrevious && (
        <Card className="mb-6 border-teal-200 bg-teal-50/50 dark:bg-teal-900/10 dark:border-teal-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium">
                <Copy className="h-4 w-4" />
                <span className="text-sm">Use a previous post as template</span>
              </div>
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
              >
                <SelectTrigger className="flex-1 bg-white dark:bg-background border-teal-200">
                  <SelectValue placeholder="Select a previous post…" />
                </SelectTrigger>
                <SelectContent>
                  {previousRequirements!.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
        >
          {/* ── SECTION 1: Basic Information ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  1
                </Badge>
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Advanced Python for Data Analysts — Batch 5"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trainingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Training Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRAINING_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skill"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Skill / Topic</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select skill…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {skillsData?.map((category) => (
                            <SelectGroup key={category.id}>
                              <SelectLabel>{category.name}</SelectLabel>
                              {category.skills.map((skill) => (
                                <SelectItem key={skill} value={skill}>
                                  {skill}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="subSkills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-topics / Additional Skills</FormLabel>
                    <FormControl>
                      <SubSkillTagInput
                        value={field.value}
                        onChange={field.onChange}
                        suggestions={allSkillSuggestions}
                        placeholder="Search or type a sub-skill, press Enter or comma to add…"
                      />
                    </FormControl>
                    <FormDescription>
                      Type to search from the list, or enter any custom skill and press <kbd className="text-xs border rounded px-1">Enter</kbd> or <kbd className="text-xs border rounded px-1">,</kbd> to add it as a tag.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── SECTION 2: Delivery & Location ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  2
                </Badge>
                Delivery Mode & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="trainingMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How will the training be conducted?</FormLabel>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      <IconCard
                        selected={field.value === "remote"}
                        onClick={() => field.onChange("remote")}
                        icon={<Wifi />}
                        label="Remote"
                        sub="Online / Virtual"
                      />
                      <IconCard
                        selected={field.value === "in-person"}
                        onClick={() => field.onChange("in-person")}
                        icon={<MapPin />}
                        label="In-Person"
                        sub="At your premises"
                      />
                      <IconCard
                        selected={field.value === "hybrid"}
                        onClick={() => field.onChange("hybrid")}
                        icon={<LayoutGrid />}
                        label="Hybrid"
                        sub="Mix of both"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(trainingMode === "in-person" || trainingMode === "hybrid") && (
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Training Location / City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Mumbai, Maharashtra"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* ── SECTION 3: Trainer Requirements ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  3
                </Badge>
                Trainer Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trainerCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Number of Trainers Needed
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trainerScope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Trainer Reach
                      </FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <IconCard
                          selected={field.value === "local"}
                          onClick={() => field.onChange("local")}
                          icon={<Navigation className="h-5 w-5" />}
                          label="Local Only"
                        />
                        <IconCard
                          selected={field.value === "pan-india"}
                          onClick={() => field.onChange("pan-india")}
                          icon={<Globe className="h-5 w-5" />}
                          label="Pan India"
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="trainerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engagement Type</FormLabel>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      <IconCard
                        selected={field.value === "part-time"}
                        onClick={() => field.onChange("part-time")}
                        icon={<Clock className="h-5 w-5" />}
                        label="Part-time"
                        sub="Flexible hours"
                      />
                      <IconCard
                        selected={field.value === "full-time"}
                        onClick={() => field.onChange("full-time")}
                        icon={<Briefcase className="h-5 w-5" />}
                        label="Full-time"
                        sub="Dedicated"
                      />
                      <IconCard
                        selected={field.value === "mentor"}
                        onClick={() => field.onChange("mentor")}
                        icon={<BookOpen className="h-5 w-5" />}
                        label="Mentor"
                        sub="Advisory role"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="benefits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                      Extra Benefits Provided
                    </FormLabel>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      <IconCard
                        selected={field.value === "ta-da"}
                        onClick={() => field.onChange("ta-da")}
                        icon={<Car className="h-5 w-5" />}
                        label="TA + DA"
                        sub="Travel & daily allowance"
                      />
                      <IconCard
                        selected={field.value === "stay-only"}
                        onClick={() => field.onChange("stay-only")}
                        icon={<BedDouble className="h-5 w-5" />}
                        label="Stay Only"
                        sub="Accommodation covered"
                      />
                      <IconCard
                        selected={field.value === "none"}
                        onClick={() => field.onChange("none")}
                        icon={<XCircle className="h-5 w-5" />}
                        label="No Benefits"
                        sub="Payout only"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── PAYOUT SECTION ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">4</Badge>
                Payout / Budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="payoutChoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Would you like to disclose the budget?</FormLabel>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <IconCard
                        selected={field.value === "discuss"}
                        onClick={() => field.onChange("discuss")}
                        icon={<MessageCircle className="h-5 w-5" />}
                        label="Discuss Later"
                        sub="Trainer will contact you"
                      />
                      <IconCard
                        selected={field.value === "reveal"}
                        onClick={() => field.onChange("reveal")}
                        icon={<IndianRupee className="h-5 w-5" />}
                        label="Reveal Budget"
                        sub="Show amount to trainers"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {payoutChoice === "reveal" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <IndianRupee className="h-4 w-4 text-muted-foreground" />
                          Total Budget (₹)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 50000"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Approximate total payout for the engagement.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fee Type</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <IconCard
                            selected={field.value === "fixed"}
                            onClick={() => field.onChange("fixed")}
                            icon={<IndianRupee className="h-5 w-5" />}
                            label="Fixed"
                            sub="Non-negotiable"
                          />
                          <IconCard
                            selected={field.value === "negotiable"}
                            onClick={() => field.onChange("negotiable")}
                            icon={<MessageCircle className="h-5 w-5" />}
                            label="Negotiable"
                            sub="Open to discuss"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── SECTION 5: Timeline ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  5
                </Badge>
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Deadline</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── SECTION 6: Description & Qualifications ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  6
                </Badge>
                Description & Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Detailed Job Description</FormLabel>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.pdf,text/plain,application/pdf"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={fileLoading}
                        >
                          {fileLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {fileLoading ? "Reading…" : "Upload .txt or .pdf"}
                        </Button>
                      </div>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the training objective, audience profile, expected outcomes, modules to be covered, and any other requirements the trainer must fulfil…"
                        className="min-h-[180px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between mt-1">
                      <FormDescription>Minimum 35 words.</FormDescription>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          wordCount >= 35
                            ? "text-teal-600"
                            : "text-muted-foreground",
                        )}
                      >
                        {wordCount >= 35 ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {wordCount}{" "}
                            words
                          </span>
                        ) : (
                          `${wordCount} / 35 words`
                        )}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="certifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certifications Required</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. AWS Certified, PMP, SHRM (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language Preference</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Hindi, English, Marathi (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            disabled={createRequirement.isPending}
          >
            {createRequirement.isPending
              ? "Posting Requirement…"
              : "Post Requirement"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
