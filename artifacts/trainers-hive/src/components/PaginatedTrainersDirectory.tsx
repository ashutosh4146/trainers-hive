import React from "react";
import { Link } from "wouter";
import {
  getListSavedTrainersQueryKey,
  getListTrainersQueryKey,
  useDeleteTrainer,
  useGetCurrentUser,
  useListSavedTrainers,
  useListSkills,
  useListTrainers,
  useSaveTrainer,
  useUnsaveTrainer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Briefcase, ChevronLeft, ChevronRight, Filter, MapPin, Plus, Search, Star, ThumbsUp, Users, X } from "lucide-react";

const PAGE_SIZE = 12;

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const wrapped = value as {
      data?: T[];
      items?: T[];
      results?: T[];
      skills?: T[];
      trainers?: T[];
      savedTrainers?: T[];
    };
    if (Array.isArray(wrapped.data)) return wrapped.data;
    if (Array.isArray(wrapped.items)) return wrapped.items;
    if (Array.isArray(wrapped.results)) return wrapped.results;
    if (Array.isArray(wrapped.skills)) return wrapped.skills;
    if (Array.isArray(wrapped.trainers)) return wrapped.trainers;
    if (Array.isArray(wrapped.savedTrainers)) return wrapped.savedTrainers;
  }
  return [];
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SkillMultiSelect({
  selected,
  onChange,
  allSkills,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  allSkills: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  const matches = React.useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return allSkills.filter((skill) => skill.toLowerCase().includes(q) && !selected.includes(skill)).slice(0, 8);
  }, [trimmed, allSkills, selected]);

  const add = (skill: string) => {
    const clean = skill.trim();
    if (!clean || selected.includes(clean)) return;
    onChange([...selected, clean]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (skill: string) => onChange(selected.filter((item) => item !== skill));
  const showCustom = trimmed.length >= 2 && !allSkills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase()) && !selected.includes(trimmed);
  const showDropdown = open && trimmed.length >= 2 && (matches.length > 0 || showCustom);

  return (
    <div className="relative space-y-2">
      <div
        className="flex min-h-[42px] cursor-text flex-wrap gap-1.5 rounded-md border bg-background p-2 focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1">
            {skill}
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              onMouseDown={(event) => {
                event.preventDefault();
                remove(skill);
              }}
              className="rounded-sm hover:bg-foreground/10"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex min-w-[120px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-0 h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            className="w-full bg-transparent pl-5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={selected.length === 0 ? "Type 2+ letters…" : ""}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === ",") && trimmed) {
                event.preventDefault();
                add(trimmed);
              }
              if (event.key === "Backspace" && !query && selected.length > 0) {
                remove(selected[selected.length - 1]);
              }
            }}
          />
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ul className="max-h-52 overflow-y-auto py-1">
            {matches.map((skill) => (
              <li key={skill}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(skill);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {skill}
                </button>
              </li>
            ))}
            {showCustom && (
              <li>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(trimmed);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Use “{trimmed}”
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Enter or comma to add · Backspace removes last</p>
    </div>
  );
}

export function PaginatedTrainersDirectory() {
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>([]);
  const [location, setLocation] = React.useState("");
  const [remote, setRemote] = React.useState(false);
  const [minExp, setMinExp] = React.useState([0]);
  const [gender, setGender] = React.useState<"all" | "male" | "female">("all");
  const [sort, setSort] = React.useState<"rating" | "experience" | "recent" | "endorsements">("rating");
  const [page, setPage] = React.useState(1);

  const debouncedLocation = useDebounce(location);
  const debouncedMinExp = useDebounce(minExp, 1000);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = {
    ...(selectedSkills.length > 0 ? { skills: selectedSkills.join(",") } : {}),
    ...(debouncedLocation ? { location: debouncedLocation } : {}),
    ...(remote ? { remote: true } : {}),
    ...(debouncedMinExp[0] > 0 ? { minExperience: debouncedMinExp[0] } : {}),
    ...(gender !== "all" ? { gender: gender as "male" | "female" } : {}),
    sort,
  };

  const { data: trainers, isLoading } = useListTrainers(queryParams, {
    query: { queryKey: getListTrainersQueryKey(queryParams) },
  });
  const { data: skillsData } = useListSkills();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isVendor = currentUser?.role === "vendor";
  const vendorId = currentUser?.role === "vendor" ? currentUser.vendorId : undefined;
  const deleteTrainer = useDeleteTrainer();
  const saveTrainer = useSaveTrainer();
  const unsaveTrainer = useUnsaveTrainer();
  const { data: savedTrainers } = useListSavedTrainers(vendorId ?? "", {
    query: { enabled: !!vendorId, queryKey: getListSavedTrainersQueryKey(vendorId ?? "") },
  });

  const trainersList = toArray<any>(trainers);
  const skillCategories = toArray<{ skills?: string[] }>(skillsData);
  const allSkills = skillCategories.flatMap((category) => (Array.isArray(category.skills) ? category.skills : []));
  const savedIds = React.useMemo(
    () => new Set(toArray<{ trainerId: string }>(savedTrainers).map((trainer) => trainer.trainerId)),
    [savedTrainers],
  );

  React.useEffect(() => {
    setPage(1);
  }, [selectedSkills, debouncedLocation, remote, debouncedMinExp[0], gender, sort]);

  const total = trainersList.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = trainersList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const activeFiltersCount = selectedSkills.length + (location ? 1 : 0) + (remote ? 1 : 0) + (minExp[0] > 0 ? 1 : 0) + (gender !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSelectedSkills([]);
    setLocation("");
    setRemote(false);
    setMinExp([0]);
    setGender("all");
    setSort("rating");
    setPage(1);
  };

  const handleToggleSave = (event: React.MouseEvent, trainerId: string, trainerName: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!vendorId) return;
    if (savedIds.has(trainerId)) {
      unsaveTrainer.mutate(
        { id: vendorId, trainerId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
            toast({ title: `Removed ${trainerName} from saved trainers` });
          },
          onError: () => toast({ title: "Error", description: "Could not remove bookmark.", variant: "destructive" }),
        },
      );
    } else {
      saveTrainer.mutate(
        { id: vendorId, data: { trainerId } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
            toast({ title: "Trainer saved!" });
          },
          onError: () => toast({ title: "Error", description: "Could not save trainer.", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <div className="container mx-auto flex flex-col gap-8 px-4 py-8 md:flex-row md:py-12">
      <aside className="w-full shrink-0 self-start space-y-6 md:sticky md:top-24 md:w-64 lg:w-72">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Filter className="h-5 w-5" /> Filters</h2>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground">
              Clear <X className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Skills</Label>
            <SkillMultiSelect selected={selectedSkills} onChange={setSelectedSkills} allSkills={allSkills} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trainer-location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="trainer-location" placeholder="City, Country..." className="pl-9" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(value) => setGender(value as "all" | "male" | "female")}>
              <SelectTrigger><SelectValue placeholder="Any gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any gender</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="remote-toggle" className="cursor-pointer">Remote Only</Label>
              <Switch id="remote-toggle" checked={remote} onCheckedChange={setRemote} />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Min Experience</Label>
              <span className="text-sm font-medium text-muted-foreground">{minExp[0]} years</span>
            </div>
            <Slider value={minExp} onValueChange={setMinExp} max={30} step={1} className="pt-2" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expert Trainers</h1>
            <p className="mt-1 text-muted-foreground">Find and hire verified training professionals.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {!isLoading && total > 0 && (
              <span className="text-sm text-muted-foreground">Showing {start}–{end} of {total}</span>
            )}
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-sm text-muted-foreground">Sort by:</Label>
              <Select value={sort} onValueChange={(value: any) => setSort(value)}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="experience">Most Experience</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                  <SelectItem value="endorsements">Most Endorsed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
                </CardHeader>
                <CardContent><div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /></div></CardContent>
              </Card>
            ))
          ) : pageItems.length > 0 ? (
            pageItems.map((trainer) => {
              const subSkills = Array.isArray(trainer.subSkills) ? trainer.subSkills : [];
              const rating = Number(trainer.rating ?? 0);
              const reviewCount = trainer.reviewCount ?? 0;
              const experienceYears = trainer.experienceYears ?? 0;
              return (
                <div key={trainer.id} className="relative">
                  {isAdmin && (
                    <div className="absolute right-3 top-3 z-10">
                      <AdminRemoveButton
                        label={`trainer ${trainer.name}`}
                        description={`This permanently removes ${trainer.name} from the marketplace, along with all their reviews and applications. This cannot be undone.`}
                        successMessage={`${trainer.name} has been removed from the marketplace.`}
                        onConfirm={async () => {
                          await deleteTrainer.mutateAsync({ id: trainer.id });
                          await queryClient.invalidateQueries({ queryKey: getListTrainersQueryKey(queryParams) });
                        }}
                      />
                    </div>
                  )}
                  {isVendor && (
                    <button
                      type="button"
                      title={savedIds.has(trainer.id) ? "Remove from saved" : "Save trainer"}
                      onClick={(event) => handleToggleSave(event, trainer.id, trainer.name)}
                      disabled={saveTrainer.isPending || unsaveTrainer.isPending}
                      className={`absolute right-3 top-3 z-10 rounded-md border p-1.5 transition-colors ${savedIds.has(trainer.id) ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                    >
                      <Bookmark className={`h-4 w-4 ${savedIds.has(trainer.id) ? "fill-primary" : ""}`} />
                    </button>
                  )}

                  <Link href={`/trainers/${trainer.id}`}>
                    <Card className="flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-md">
                      <CardHeader className="flex flex-row items-start gap-4 pb-2">
                        <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} className="h-12 w-12 border border-border" />
                        <div className="min-w-0 flex-1 pr-8">
                          <CardTitle className="flex items-center gap-2 truncate text-lg">
                            {trainer.name}
                            {trainer.verified && <Badge variant="secondary" className="h-5 bg-blue-100 px-1.5 py-0 text-blue-800 hover:bg-blue-100">Verified</Badge>}
                          </CardTitle>
                          <CardDescription className="mt-1 truncate text-sm text-muted-foreground">{trainer.headline}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between py-2">
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="border-primary/20 bg-primary/5 font-normal text-primary">{trainer.mainSkill}</Badge>
                          {subSkills.slice(0, 3).map((skill: string) => <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">{skill}</Badge>)}
                          {subSkills.length > 3 && <Badge variant="outline" className="border-dashed font-normal text-muted-foreground">+{subSkills.length - 3}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 border-t pt-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Star className="h-4 w-4 fill-amber-500 text-amber-500" /><span className="font-medium text-foreground">{Number.isFinite(rating) ? rating.toFixed(1) : "0.0"}</span><span>({reviewCount})</span></div>
                          <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /><span>{experienceYears}y exp</span></div>
                          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span className="max-w-[100px] truncate">{trainer.location}</span></div>
                          {(trainer.endorsementCount ?? 0) > 0 && (
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground"><ThumbsUp className="h-4 w-4 text-emerald-600" /><span className="font-medium text-emerald-700">{trainer.endorsementCount}</span><span>{trainer.endorsementCount === 1 ? "endorsement" : "endorsements"}</span></div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="col-span-1 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-20 text-center lg:col-span-2">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-1 text-lg font-semibold text-foreground">No trainers found</h3>
              <p className="max-w-md text-muted-foreground">We couldn't find any trainers matching your current filters. Try adjusting your search criteria.</p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button>
            </div>
          )}
        </div>

        {!isLoading && total > PAGE_SIZE && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Showing {start}–{end} of {total} trainers</p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="px-2 text-sm tabular-nums text-muted-foreground">Page {safePage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
