import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateHireInquiry } from "@workspace/api-client-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Users, Search, ShieldCheck, Zap, Clock, Building2, Mail, Phone,
  MapPin, IndianRupee, CalendarDays, Briefcase, ChevronRight,
} from "lucide-react";

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Your name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  trainingNeed: z.string().min(20, "Please describe your training need in a little more detail"),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  headcount: z.string().optional(),
  location: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const WHY_US = [
  { icon: <Search className="h-5 w-5" />, title: "We Source For You", desc: "We tap our verified trainer network and hand-pick the best fit — you don't browse any listings." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Vetted Trainers Only", desc: "Every trainer is background-checked, reviewed, and rated by previous clients before we recommend them." },
  { icon: <Zap className="h-5 w-5" />, title: "Fast Turnaround", desc: "Most engagements are matched and confirmed within 48–72 hours of your inquiry." },
  { icon: <Users className="h-5 w-5" />, title: "End-to-End Delivery", desc: "We act as your training partner — coordination, scheduling, and feedback loop included." },
];

const TIMELINE_OPTIONS = ["ASAP (within 2 weeks)", "1 month", "2–3 months", "Flexible / ongoing"];
const HEADCOUNT_OPTIONS = ["1–10", "11–30", "31–100", "100+"];

export default function HireUs() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const createInquiry = useCreateHireInquiry();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "", contactName: "", email: "", phone: "",
      trainingNeed: "", budget: "", timeline: "", headcount: "", location: "",
    },
  });

  function onSubmit(data: FormValues) {
    createInquiry.mutate(
      { data },
      {
        onSuccess: () => setSubmitted(true),
        onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex flex-col items-center text-center gap-5">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Managed Training Service
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Let Us Find the Right<br className="hidden md:block" /> Trainer for You
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Skip the search. Tell us what you need — we act as your vendor and deliver verified trainers, fully managed. No browsing, no sourcing, no guesswork.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> No upfront cost</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> 48-hr match</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> 500+ trainers</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Left — Why us */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Why hire through us?</h2>
              <p className="text-sm text-muted-foreground">We don't just connect — we deliver.</p>
            </div>

            <div className="space-y-4">
              {WHY_US.map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Card className="bg-muted/40 border-dashed">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
                {[
                  "Fill the form — takes 2 minutes",
                  "We reach out within 24 hours",
                  "We shortlist & present trainers",
                  "You approve → training begins",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</span>
                    {step}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right — Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Inquiry Received!</h2>
                  <p className="text-muted-foreground max-w-sm">
                    Thanks! Our team will review your requirement and reach out within <strong>24 hours</strong> with next steps.
                  </p>
                  <Button variant="outline" onClick={() => { form.reset(); setSubmitted(false); }}>
                    Submit Another Inquiry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-5">Tell us about your training need</h2>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="companyName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Company / Organisation</FormLabel>
                            <FormControl><Input placeholder="Acme Corp" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="contactName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Name</FormLabel>
                            <FormControl><Input placeholder="Priya Sharma" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Work Email</FormLabel>
                            <FormControl><Input type="email" placeholder="you@company.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                            <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="trainingNeed" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Training Requirement</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. We need a trainer for Advanced Excel for 25 finance executives — 2-day workshop, Bangalore. Looking for someone with hands-on corporate training experience."
                              className="min-h-[110px] resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>The more detail you share, the faster we can match you.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField control={form.control} name="headcount" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Headcount</FormLabel>
                            <div className="grid grid-cols-2 gap-1.5 mt-1">
                              {HEADCOUNT_OPTIONS.map((opt) => (
                                <button
                                  key={opt} type="button"
                                  onClick={() => field.onChange(opt)}
                                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${field.value === opt ? "border-primary bg-primary/10 text-primary" : "border-input hover:border-primary/50"}`}
                                >{opt}</button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="timeline" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Timeline</FormLabel>
                            <div className="grid grid-cols-1 gap-1.5 mt-1">
                              {TIMELINE_OPTIONS.map((opt) => (
                                <button
                                  key={opt} type="button"
                                  onClick={() => field.onChange(opt)}
                                  className={`rounded-md border px-2 py-1.5 text-xs font-medium text-left transition-colors ${field.value === opt ? "border-primary bg-primary/10 text-primary" : "border-input hover:border-primary/50"}`}
                                >{opt}</button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <div className="space-y-4">
                          <FormField control={form.control} name="budget" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Approx Budget</FormLabel>
                              <FormControl><Input placeholder="e.g. ₹50,000" {...field} /></FormControl>
                              <FormDescription className="text-xs">Optional</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="location" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</FormLabel>
                              <FormControl><Input placeholder="e.g. Mumbai or Remote" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>

                      <Button type="submit" className="w-full gap-2" size="lg" disabled={createInquiry.isPending}>
                        {createInquiry.isPending ? "Submitting…" : (
                          <><span>Submit Inquiry</span><ChevronRight className="h-4 w-4" /></>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        No commitment. Our team will contact you within 24 hours.
                      </p>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
