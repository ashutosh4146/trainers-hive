import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateRequirement,
  useListSkills,
  useGetCurrentUser,
  getListRequirementsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2 } from "lucide-react";
import { Link } from "wouter";

const requirementSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  skill: z.string().min(1, "Please select a primary skill"),
  subSkills: z.string(), // We'll handle this as a comma separated string for simplicity in the form if multi-select isn't available
  durationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
  budget: z.coerce.number().min(1, "Budget must be greater than 0"),
  feeType: z.enum(["fixed", "negotiable"]),
  location: z.string().min(2, "Location is required"),
  remote: z.boolean().default(false),
  deadline: z.string().min(1, "Deadline is required"),
  description: z.string().min(30, "Description must be at least 30 characters"),
});

type RequirementFormValues = z.infer<typeof requirementSchema>;

export default function NewRequirement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: skillsData } = useListSkills();
  const createRequirement = useCreateRequirement();

  const form = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      title: "",
      skill: "",
      subSkills: "",
      durationDays: 30,
      budget: 0,
      feeType: "fixed",
      location: "",
      remote: false,
      deadline: "",
      description: "",
    },
  });

  const onSubmit = (data: RequirementFormValues) => {
    // Parse subSkills from comma separated string
    const subSkillsArray = data.subSkills.split(",").map(s => s.trim()).filter(Boolean);

    createRequirement.mutate(
      {
        data: {
          ...data,
          subSkills: subSkillsArray,
        }
      },
      {
        onSuccess: (newReq) => {
          toast({ title: "Requirement posted", description: "Your requirement has been successfully created." });
          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
          setLocation(`/requirements/${newReq.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to post requirement. Please try again.", variant: "destructive" });
        }
      }
    );
  };

  if (userLoading) return <div className="container py-12">Loading...</div>;

  if (user?.role !== "vendor") {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Vendor Access Required</h2>
        <p className="text-muted-foreground mb-6">Only verified vendors can post training requirements.</p>
        <Link href="/requirements">
          <Button variant="outline">Browse Requirements</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <div className="mb-6">
        <Link href="/requirements" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Requirements
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Post a New Requirement</h1>
        <p className="text-muted-foreground mt-1">Fill out the details below to find the perfect trainer for your needs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requirement Details</CardTitle>
          <CardDescription>Be as specific as possible to attract the right trainers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirement Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Advanced React & Next.js Workshop" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="skill"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Skill</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a primary skill" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {skillsData?.map((category) => (
                              <SelectGroup key={category.id}>
                                <SelectLabel>{category.name}</SelectLabel>
                                {category.skills.map(skill => (
                                  <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subSkills"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-skills (comma separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Typescript, Tailwind, Redux" {...field} />
                        </FormControl>
                        <FormDescription>Separate multiple skills with commas.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Logistics & Budget</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. New York, NY or Online" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="remote"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Remote Allowed</FormLabel>
                          <FormDescription>Can this be done virtually?</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget (Total)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input type="number" min={0} className="pl-7" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feeType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Fee Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="fixed" id="fee-type-fixed" />
                              <Label htmlFor="fee-type-fixed" className="font-normal cursor-pointer">Fixed</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="negotiable" id="fee-type-negotiable" />
                              <Label htmlFor="fee-type-negotiable" className="font-normal cursor-pointer">Negotiable</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Description</h3>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide full details about the requirement, expectations, and any specific trainer qualifications needed..." 
                          className="min-h-[200px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Minimum 30 characters.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={createRequirement.isPending}>
                {createRequirement.isPending ? "Posting..." : "Post Requirement"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
