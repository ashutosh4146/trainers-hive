import React, { useState, useRef } from "react";
import { Link } from "wouter";
import {
  useListRequirements,
  getListRequirementsQueryKey,
  useListSkills,
  getListSkillsQueryKey,
  useGetCurrentUser,
  useDeleteRequirement,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Briefcase, Filter, X, Building, BookOpen, Clock, Users, ArrowRight, ShieldCheck, Zap, Star, Lock, Handshake, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

// ── Multi-select skill combobox (shared pattern) ─────────────────────────────
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
    return allSkills.filter((s) => s.toLowerCase().includes(q) && !selected.includes(s)).slice(0, 8);
  }, [trimmed, allSkills, selected]);
  const customExists = allSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const showCustom = trimmed.length >= 2 && !customExists && !selected.includes(trimmed);
  const add = (skill: string) => {
    const s = skill.trim();
    if (!s || selected.includes(s)) return;
    onChange([...selected, s]);
    setQuery("");
    inputRef.current?.focus();
  };
  const remove = (skill: string) => onChange(selected.filter((s) => s !== skill));
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && trimmed) { e.preventDefault(); add(trimmed); }
    else if (e.key === "Backspace" && query === "" && selected.length > 0) { remove(selected[selected.length - 1]); }
    else if (e.key === "Escape") { setOpen(false); }
  };
  return (
    <div className="relative space-y-2">
      <div
        className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-md border bg-background cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((s) => (
          <Badge key={s} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1 shrink-0">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onMouseDown={(e) => { e.preventDefault(); remove(s); }} className="hover:bg-foreground/10 rounded-sm">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 flex items-center min-w-[120px]">
          <Search className="absolute left-0 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            className="w-full pl-5 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
            placeholder={selected.length === 0 ? "Type 2+ letters…" : ""}
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
                <button type="button" onMouseDown={(e) => { e.preventDefault(); add(s); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">{s}</button>
              </li>
            ))}
            {showCustom && (
              <li>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); add(trimmed); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 text-muted-foreground">
                  <Plus className="h-3.5 w-3.5 shrink-0" /> Use "{trimmed}" as custom skill
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Requirements() {
  const { data: user } = useGetCurrentUser();
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [status, setStatus] = useState<string>("open");
  const [sort, setSort] = useState<"recent" | "deadline" | "budget">("recent");

  const queryParams = {
    ...(search ? { q: search } : {}),
    ...(selectedSkills.length > 0 ? { skills: selectedSkills.join(",") } : {}),
    ...(location ? { location } : {}),
    ...(remote ? { remote: true } : {}),
    ...(status !== "all" ? { status: status as any } : {}),
    sort,
  };

  const { data: requirements, isLoading } = useListRequirements(queryParams, {
    query: { queryKey: getListRequirementsQueryKey(queryParams) }
  });

  const { data: skillsData } = useListSkills({
    query: { queryKey: getListSkillsQueryKey() }
  });

  const isAdmin = user?.role === "admin";
  const deleteRequirement = useDeleteRequirement();
  const queryClient = useQueryClient();

  const allSkills = skillsData?.flatMap(cat => cat.skills) || [];

  const clearFilters = () => {
    setSearch("");
    setSelectedSkills([]);
    setLocation("");
    setRemote(false);
    setStatus("open");
    setSort("recent");
  };

  const activeFiltersCount = (search ? 1 : 0) + (selectedSkills.length > 0 ? 1 : 0) + (location ? 1 : 0) + (remote ? 1 : 0) + (status !== "open" ? 1 : 0);

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
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Title or keyword..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skill Required</Label>
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
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="vacant">Vacant (No applicants)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="remote-toggle" className="cursor-pointer">Remote OK</Label>
              <Switch id="remote-toggle" checked={remote} onCheckedChange={setRemote} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Training Requirements</h1>
            <p className="text-muted-foreground mt-1">
              Browse open training opportunities posted by verified institutions.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start sm:self-auto">
            {user?.role === "vendor" && (
              <Link href="/requirements/new">
                <Button className="shrink-0">Post Requirement</Button>
              </Link>
            )}
            <div className="flex items-center gap-2">
              <Label className="hidden lg:block whitespace-nowrap text-sm text-muted-foreground">Sort:</Label>
              <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="deadline">Closing Soon</SelectItem>
                  <SelectItem value="budget">Highest Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
             Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                      <div className="flex gap-4 pt-3">
                        <Skeleton className="h-5 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : requirements?.length ? (
            requirements.map((req) => (
              <div key={req.id} className="relative">
                {isAdmin && (
                  <div className="absolute top-3 right-3 z-10">
                    <AdminRemoveButton
                      label={`requirement "${req.title}"`}
                      description={`This permanently removes this requirement and all applications submitted to it. This cannot be undone.`}
                      successMessage="Requirement removed."
                      onConfirm={async () => {
                        await deleteRequirement.mutateAsync({ id: req.id });
                        await queryClient.invalidateQueries({
                          queryKey: getListRequirementsQueryKey(queryParams),
                        });
                      }}
                    />
                  </div>
                )}
                <Link href={`/requirements/${req.id}`}>
                  <Card className={`hover:shadow-md transition-all group overflow-hidden cursor-pointer ${req.status === 'closed' ? 'opacity-70 grayscale-[0.3]' : 'hover:border-primary/50'}`}>
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-6 flex-1 flex flex-col gap-4 min-w-0">
                        <div className="flex items-start gap-4 min-w-0">
                          <Avatar className="h-12 w-12 rounded-md border bg-white shrink-0 mt-1">
                            <AvatarImage src={req.vendorLogoUrl} alt={req.vendorName} className="object-contain p-1" />
                            <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                              <Building className="h-6 w-6" />
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className={`flex items-start justify-between gap-2 mb-1 ${isAdmin ? "pr-10" : ""}`}>
                              <h3 className="font-semibold text-xl truncate group-hover:text-primary transition-colors min-w-0 flex-1">
                                {req.title}
                              </h3>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                {(req as any).isUrgent && (
                                  <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <Zap className="h-3 w-3" /> Urgent
                                  </span>
                                )}
                                {(req as any).isFeatured && (
                                  <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <Star className="h-3 w-3" /> Featured
                                  </span>
                                )}
                                {(req as any).isPrivate && (
                                  <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <Lock className="h-3 w-3" /> Private
                                  </span>
                                )}
                                {(req as any).hireThroughUs && (
                                  <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <Handshake className="h-3 w-3" /> Hire Through Us
                                  </span>
                                )}
                                <Badge variant={req.status === 'open' ? 'default' : req.status === 'vacant' ? 'destructive' : 'secondary'} className="capitalize">
                                  {req.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{req.vendorName}</span>
                              {req.vendorVerified && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center text-primary cursor-default">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>This company is verified by Trainers Hive</TooltipContent>
                                </Tooltip>
                              )}
                              <span>•</span>
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.location} {req.remote && "(Remote Optional)"}</span>
                              <span>•</span>
                              <span>Posted {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm pt-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium bg-primary/5 text-primary px-2 py-0.5 rounded border border-primary/20">{req.skill}</span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{req.durationDays} days duration</span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-4 w-4" />
                            <span className="font-medium text-foreground capitalize">
                              {(req as any).budget > 0
                                ? `₹${((req as any).budget as number).toLocaleString("en-IN")}${(req as any).feeType === "negotiable" ? " (Negotiable)" : ""}`
                                : "Discuss payout"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{req.applicationCount} Applicants</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/30 p-6 flex flex-row sm:flex-col items-center sm:justify-center gap-4 border-t sm:border-t-0 sm:border-l sm:w-48 shrink-0">
                        <div className="text-center sm:w-full">
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Deadline</p>
                          <p className="font-medium text-foreground">
                            {new Date(req.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <Button className="w-full ml-auto sm:ml-0" variant={req.status === 'open' ? 'default' : 'secondary'} tabIndex={-1}>
                          View Details <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/30 border-dashed">
              <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No requirements found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any training requirements matching your current filters.
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
