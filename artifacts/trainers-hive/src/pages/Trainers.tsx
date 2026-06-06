import React, { useState, useRef } from "react";
import { Link } from "wouter";
import {
  useListTrainers,
  getListTrainersQueryKey,
  useListSkills,
  getListSkillsQueryKey,
  useGetCurrentUser,
  useDeleteTrainer,
  useListSavedTrainers,
  useSaveTrainer,
  useUnsaveTrainer,
  getListSavedTrainersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Star, MapPin, Briefcase, Filter, X, Users, Bookmark, Plus, ThumbsUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

// ── Multi-select skill combobox ──────────────────────────────────────────────
function SkillMultiSelect({
  selected,
  onChange,
  allSkills,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  allSkills: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length >= 2;

  const matches = React.useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return allSkills
      .filter((s) => s.toLowerCase().includes(q) && !selected.includes(s))
      .slice(0, 8);
  }, [trimmed, allSkills, selected]);

  const customExists = allSkills.some(
    (s) => s.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCustom =
    trimmed.length >= 2 && !customExists && !selected.includes(trimmed);

  const add = (skill: string) => {
    const s = skill.trim();
    if (!s || selected.includes(s)) return;
    onChange([...selected, s]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (skill: string) =>
    onChange(selected.filter((s) => s !== skill));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && trimmed) {
      e.preventDefault();
      add(trimmed);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative space-y-2">
      <div
        className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-md border bg-background cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((s) => (
          <Badge
            key={s}
            variant="secondary"
            className="pl-2 pr-1 py-0.5 gap-1 shrink-0"
          >
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onMouseDown={(e) => { e.preventDefault(); remove(s); }}
              className="hover:bg-foreground/10 rounded-sm"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 flex items-center min-w-[120px]">
          <Search className="absolute left-0 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            className="w-full pl-5 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
            placeholder={selected.length === 0 ? "Type 2+ letters to search skills…" : ""}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKey}
          />
        </div>
      </div>

      {showDropdown && (matches.length > 0 || showCustom) && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md">
          <ul className="py-1 max-h-52 overflow-y-auto">
            {matches.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(s); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                >
                  {s}
                </button>
              </li>
            ))}
            {showCustom && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(trimmed); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 text-muted-foreground"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Use "{trimmed}" as custom skill
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Enter or comma to add · Backspace removes last
      </p>
    </div>
  );
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Trainers() {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [minExp, setMinExp] = useState([0]);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [sort, setSort] = useState<"rating" | "experience" | "recent" | "endorsements">("rating");

  const debouncedLocation = useDebounce(location);
  const debouncedMinExp = useDebounce(minExp, 1000);

  const queryParams = {
    ...(selectedSkills.length > 0 ? { skills: selectedSkills.join(",") } : {}),
    ...(debouncedLocation ? { location: debouncedLocation } : {}),
    ...(remote ? { remote: true } : {}),
    ...(debouncedMinExp[0] > 0 ? { minExperience: debouncedMinExp[0] } : {}),
    ...(gender !== "all" ? { gender: gender as "male" | "female" } : {}),
    sort,
  };

  const { data: trainers, isLoading } = useListTrainers(queryParams, {
    query: { queryKey: getListTrainersQueryKey(queryParams) }
  });

  const { data: skillsData } = useListSkills({
    query: { queryKey: getListSkillsQueryKey() }
  });

  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isVendor = currentUser?.role === "vendor";
  const vendorId = currentUser?.role === "vendor" ? currentUser.vendorId : undefined;
  const deleteTrainer = useDeleteTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedTrainers } = useListSavedTrainers(vendorId ?? "", {
    query: { enabled: !!vendorId, queryKey: getListSavedTrainersQueryKey(vendorId ?? "") },
  });
  const savedTrainersList = toArray<{ trainerId: string }>(savedTrainers);
  const savedIds = React.useMemo(() => new Set(savedTrainersList.map((s) => s.trainerId)), [savedTrainersList]);
  const saveTrainer = useSaveTrainer();
  const unsaveTrainer = useUnsaveTrainer();

  const handleToggleSave = (e: React.MouseEvent, trainerId: string, trainerName: string) => {
    e.preventDefault();
    e.stopPropagation();
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

  const trainersList = toArray(trainers);
  const skillCategories = toArray<{ skills?: string[] }>(skillsData);
  const allSkills = skillCategories.flatMap((cat) => Array.isArray(cat.skills) ? cat.skills : []);

  const clearFilters = () => {
    setSelectedSkills([]);
    setLocation("");
    setRemote(false);
    setMinExp([0]);
    setGender("all");
    setSort("rating");
  };

  const activeFiltersCount = selectedSkills.length + (location ? 1 : 0) + (remote ? 1 : 0) + (minExp[0] > 0 ? 1 : 0) + (gender !== "all" ? 1 : 0);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 lg:w-72 shrink-0 self-start sticky top-24 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filters
          </h2>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground">
              Clear <X className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Skills</Label>
            <SkillMultiSelect
              selected={selectedSkills}
              onChange={setSelectedSkills}
              allSkills={allSkills}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="City, Country..."
                className="pl-9"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as "all" | "male" | "female")}>
              <SelectTrigger>
                <SelectValue placeholder="Any gender" />
              </SelectTrigger>
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

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>Min Experience</Label>
              <span className="text-sm font-medium text-muted-foreground">{minExp[0]} years</span>
            </div>
            <Slider
              value={minExp}
              onValueChange={setMinExp}
              max={30}
              step={1}
              className="pt-2"
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expert Trainers</h1>
            <p className="text-muted-foreground mt-1">
              Find and hire verified training professionals.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Label className="whitespace-nowrap text-sm text-muted-foreground">Sort by:</Label>
            <Select value={sort} onValueChange={(v: any) => setSort(v)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="experience">Most Experience</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="endorsements">Most Endorsed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
             Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : trainersList.length ? (
            trainersList.map((trainer) => {
              const subSkills = Array.isArray(trainer.subSkills) ? trainer.subSkills : [];
              const rating = Number(trainer.rating ?? 0);
              const reviewCount = trainer.reviewCount ?? 0;
              const experienceYears = trainer.experienceYears ?? 0;

              return (
                <div key={trainer.id} className="relative">
                  {isAdmin && (
                    <div className="absolute top-3 right-3 z-10">
                      <AdminRemoveButton
                        label={`trainer ${trainer.name}`}
                        description={`This permanently removes ${trainer.name} from the marketplace, along with all their reviews and applications. This cannot be undone.`}
                        successMessage={`${trainer.name} has been removed from the marketplace.`}
                        onConfirm={async () => {
                          await deleteTrainer.mutateAsync({ id: trainer.id });
                          await queryClient.invalidateQueries({
                            queryKey: getListTrainersQueryKey(queryParams),
                          });
                        }}
                      />
                    </div>
                  )}
                  {isVendor && (
                    <button
                      title={savedIds.has(trainer.id) ? "Remove from saved" : "Save trainer"}
                      onClick={(e) => handleToggleSave(e, trainer.id, trainer.name)}
                      disabled={saveTrainer.isPending || unsaveTrainer.isPending}
                      className={`absolute top-3 right-3 z-10 p-1.5 rounded-md border transition-colors ${
                        savedIds.has(trainer.id)
                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                          : "border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/40"
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${savedIds.has(trainer.id) ? "fill-primary" : ""}`} />
                    </button>
                  )}
                  <Link href={`/trainers/${trainer.id}`}>
                    <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group flex flex-col">
                      <CardHeader className="flex flex-row items-start gap-4 pb-2">
                        <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} className="h-12 w-12 border border-border" />
                        <div className="flex-1 min-w-0 pr-8">
                          <CardTitle className="text-lg flex items-center gap-2 truncate">
                            {trainer.name}
                            {trainer.verified && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 px-1.5 py-0 h-5">Verified</Badge>}
                          </CardTitle>
                          <CardDescription className="truncate text-sm text-muted-foreground mt-1">
                            {trainer.headline}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 flex-1 flex flex-col justify-between">
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary">
                            {trainer.mainSkill}
                          </Badge>
                          {subSkills.slice(0, 3).map((skill: string) => (
                            <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">
                              {skill}
                            </Badge>
                          ))}
                          {subSkills.length > 3 && (
                            <Badge variant="outline" className="font-normal text-muted-foreground border-dashed">
                              +{subSkills.length - 3}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-y-3 pt-3 border-t text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            <span className="font-medium text-foreground">{Number.isFinite(rating) ? rating.toFixed(1) : "0.0"}</span>
                            <span>({reviewCount})</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-4 w-4" />
                            <span>{experienceYears}y exp</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate max-w-[100px]">{trainer.location}</span>
                          </div>
                          {(trainer.endorsementCount ?? 0) > 0 && (
                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                              <ThumbsUp className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium text-emerald-700">{trainer.endorsementCount}</span>
                              <span>{trainer.endorsementCount === 1 ? "endorsement" : "endorsements"}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/30 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No trainers found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any trainers matching your current filters. Try adjusting your search criteria.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
