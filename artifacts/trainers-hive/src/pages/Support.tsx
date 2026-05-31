import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, LifeBuoy, Mail, MessageSquare, Clock, ChevronRight,
  FileQuestion, AlertCircle, CreditCard, UserCog, BookOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  category: z.string().min(1, "Please select a category"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Please describe your issue in more detail"),
  priority: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES = [
  { value: "account", label: "Account & Login", icon: <UserCog className="h-4 w-4" /> },
  { value: "billing", label: "Billing & Payments", icon: <CreditCard className="h-4 w-4" /> },
  { value: "trainer_profile", label: "Trainer Profile", icon: <BookOpen className="h-4 w-4" /> },
  { value: "requirements", label: "Requirements & Hiring", icon: <FileQuestion className="h-4 w-4" /> },
  { value: "technical", label: "Technical Issue", icon: <AlertCircle className="h-4 w-4" /> },
  { value: "other", label: "Other", icon: <MessageSquare className="h-4 w-4" /> },
];

const FAQ = [
  {
    q: "How long does it take to get a response?",
    a: "We aim to respond to all tickets within 24 business hours. Priority issues are addressed within 4 hours.",
  },
  {
    q: "How do I update my trainer profile?",
    a: "Sign in and go to Profile from the top-right menu. You can update all your details there.",
  },
  {
    q: "Can vendors post requirements for free?",
    a: "Yes, posting a requirement is free. You only pay when you engage a trainer through the platform.",
  },
  {
    q: "How do I verify my account?",
    a: "Check your email for a verification link sent at registration. If it expired, use Settings → Resend Verification.",
  },
];

export default function Support() {
  const { auth } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [ticketId] = useState(() => "TH-" + Math.floor(10000 + Math.random() * 90000));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: auth?.name || "",
      email: auth?.email || "",
      category: "",
      subject: "",
      description: "",
      priority: "normal",
    },
  });

  function onSubmit(_data: FormValues) {
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-16 md:py-20 max-w-5xl">
          <div className="flex flex-col items-center text-center gap-4">
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Help & Support
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">How can we help?</h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Raise a support ticket and our team will get back to you as soon as possible.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> Response within 24 hrs</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Dedicated support team</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-primary" /> support@trainershive.com</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Frequently Asked Questions</h2>
              <p className="text-sm text-muted-foreground">Quick answers to common questions.</p>
            </div>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-lg border bg-card p-4 space-y-1">
                  <p className="text-sm font-semibold">{item.q}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
            <Card className="bg-muted/40 border-dashed">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">Still need help?</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email us directly at{" "}
                  <a href="mailto:support@trainershive.com" className="text-primary underline-offset-2 hover:underline">
                    support@trainershive.com
                  </a>{" "}
                  or fill in the form and we will create a case for you.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {submitted ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-10 flex flex-col items-center text-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Ticket Raised!</h2>
                  <p className="text-muted-foreground max-w-sm">
                    Your support ticket{" "}
                    <span className="font-mono font-semibold text-primary">{ticketId}</span>{" "}
                    has been created. We will reach out to{" "}
                    <span className="font-medium">{form.getValues("email")}</span> within 24 hours.
                  </p>
                  <Button variant="outline" onClick={() => { form.reset({ name: auth?.name || "", email: auth?.email || "", category: "", subject: "", description: "", priority: "normal" }); setSubmitted(false); }}>
                    Raise Another Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-5">Create a Support Ticket</h2>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Name</FormLabel>
                            <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</FormLabel>
                            <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    <span className="flex items-center gap-2">
                                      {cat.icon}
                                      {cat.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="priority" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Normal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl><Input placeholder="Brief summary of your issue" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please describe the issue in detail. Include any steps to reproduce it, screenshots links, or relevant information."
                              className="min-h-[130px] resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>The more detail you provide, the faster we can resolve it.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <Button type="submit" className="w-full gap-2" size="lg">
                        <span>Submit Ticket</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        We will respond to your email within 24 business hours.
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
