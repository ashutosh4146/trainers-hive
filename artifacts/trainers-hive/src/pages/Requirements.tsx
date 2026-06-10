import React, { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
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
import { Search, MapPin, Briefcase, Filter, X, Building, BookOpen, Clock, Users, ArrowRight, ShieldCheck, Zap, Star, Lock, Handshake, Plus, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 10;

type PaginatedMeta = { total?: number; page?: number; limit?: number; hasMore?: boolean; nextPage?: number | null };

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const wrapped = value as { data?: T[]; items?: T[]; results?: T[]; skills?: T[]; requirements?: T[] };
    if (Array.isArray(wrapped.data)) return wrapped.data;
    if (Array.isArray(wrapped.items)) return wrapped.items;
    if (Array.isArray(wrapped.results)) return wrapped.results;
    if (Array.isArray(wrapped.skills)) return wrapped.skills;
    if (Array.isArray(wrapped.requirements)) return wrapped.requirements;
  }
  return [];
}

function getPaginationMeta(value: unknown): PaginatedMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const wrapped = value as Record<string, any>;
  const meta = (wrapped.meta && typeof wrapped.meta === "object") ? wrapped.meta : wrapped;
  return {
    total: typeof meta.total === "number" ? meta.total : typeof meta.totalCount === "number" ? meta.totalCount : undefined,
    page: typeof meta.page === "number" ? meta.page : typeof meta.currentPage === "number" ? meta.currentPage : undefined,
    limit: typeof meta.limit === "number" ? meta.limit : typeof meta.pageSize === "number" ? meta.pageSize : undefined,
    hasMore: typeof meta.hasMore === "boolean" ? meta.hasMore : undefined,
    nextPage: typeof meta.nextPage === "number" || meta.nextPage === null ? meta.nextPage : undefined,
  };
}

function hasDeadlinePassed(value: unknown) {
  if (!value) return false;
  const deadline = new Date(String(value));
  if (Number.isNaN(deadline.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);
  return deadline.getTime() < today.getTime();
}

function formatDate(value: unknown) {
  if (!value) return "Flexible";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Flexible";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function budgetLabel(req: any) {
  return Number(req?.budget) > 0
    ? `₹${Number(req.budget).toLocaleString("en-IN")}${req.feeType === "negotiable" ? " (Negotiable)" : ""}`
    : "Discuss payout";
}

function requirementMode(req: any) {
  if (req.trainingMode) return String(req.trainingMode).replace(/-/g, " ");
  return req.remote ? "Remote" : "On-site";
}

function getTrainerApplicationStatus(req: any) {
  return req.applicationStatus || req.currentUserApplicationStatus || req.myApplicationStatus || req.trainerApplicationStatus || null;
}

function statusLabel(req: any) {
  if (hasDeadlinePassed(req.deadline)) return "Expired";
  return req.status || "open";
}

function statusVariant(req: any): "default" | "secondary" | "destructive" | "outline" {
  const label = statusLabel(req).toLowerCase();
  if (label === "open") return "default";
  if (label === "expired" || label === "vacant") return "destructive";
  return "secondary";
}

function SkillMultiSelect({ selected, onChange, allSkills }: { selected: string[]; onChange: (next: string[]) => void; allSkills: string[] }) {
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
      <div className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-md border bg-background cursor-text focus-within:ring-1 focus-within:ring-ring" onClick={() => inputRef.current?.focus()}>
        {selected.map((s) => (
          <Badge key={s} variant="secondary" className="pl-2 pr-1 py-0.5 gap-1 shrink-0">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onMouseDown={(e) => { e.preventDefault(); remove(s); }} className="hover:bg-foreground/10 rounded-sm"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        <div className="relative flex-1 flex items-center min-w-[120px]">
          <Search className="absolute left-0 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input ref={inputRef} className="w-full pl-5 outline-none bg-transparent text-sm placeholder:text-muted-foreground" placeholder={selected.length === 0 ? "Type 2+ letters…" : ""} value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={handleKey} />
        </div>
      </div>
      {showDropdown && (matches.length > 0 || showCustom) && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md">
          <ul className="py-1 max-h-52 overflow-y-auto">
            {matches.map((s) => <li key={s}><button type="button" onMouseDown={(e) => { e.preventDefault(); add(s); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">{s}</button></li>)}
            {showCustom && <li><button type="button" onMouseDown={(e) => { e.preventDefault(); add(trimmed); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 text-muted-foreground"><Plus className="h-3.5 w-3.5 shrink-0" /> Use "{trimmed}" as custom skill</button></li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function GuestPreviewModal({ requirement, onClose }: { requirement: any | null; onClose: () => void }) {
  if (!requirement) return null;
  const loginHref = `/login?redirect=/requirements/${requirement.id}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="relative w-full max-w-2xl overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="border-b bg-primary/5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Badge variant="outline" className="mb-3 border-primary/30 bg-background text-primary">Public preview</Badge>
                <h2 className="text-2xl font-bold leading-tight tracking-tight">{requirement.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Login is required to view full requirement details and apply.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close preview"><X className="h-5 w-5" /></Button>
            </div>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-3"><BookOpen className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Skill</p><p className="font-semibold">{requirement.skill || "Not specified"}</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><MapPin className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Mode / Location</p><p className="font-semibold capitalize">{requirementMode(requirement)}{requirement.location ? ` · ${requirement.location}` : ""}</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><Clock className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Duration</p><p className="font-semibold">{requirement.durationDays ?? "—"} days</p></div>
              <div className="rounded-xl border bg-muted/20 p-3"><Briefcase className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Budget</p><p className="font-semibold">{budgetLabel(requirement)}</p></div>
              <div className="rounded-xl border bg-muted/20 p-3 sm:col-span-2"><CalendarDays className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Deadline</p><p className="font-semibold">{hasDeadlinePassed(requirement.deadline) ? "Applications closed" : formatDate(requirement.deadline)}</p></div>
            </div>
            {requirement.description && <p className="line-clamp-4 rounded-xl border bg-background p-4 text-sm leading-relaxed text-muted-foreground">{requirement.description}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>Keep browsing</Button>
              <Button asChild><Link href={loginHref}>Login to view full details and apply <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Requirements() {
  const { data: user } = useGetCurrentUser();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [status, setStatus] = useState<string>("open");
  const [sort, setSort] = useState<"recent" | "deadline" | "budget">("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewRequirement, setPreviewRequirement] = useState<any | null>(null);

  const queryParams = {
    ...(search ? { q: search } : {}),
    ...(selectedSkills.length > 0 ? { skills: selectedSkills.join(",") } : {}),
    ...(location ? { location } : {}),
    ...(remote ? { remote: true } : {}),
    ...(status !== "all" ? { status: status as any } : {}),
    sort,
  };

  const { data: requirements, isLoading } = useListRequirements(queryParams, { query: { queryKey: getListRequirementsQueryKey(queryParams) } });
  const { data: skillsData } = useListSkills({ query: { queryKey: getListSkillsQueryKey() } });

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user?.role;
  const deleteRequirement = useDeleteRequirement();
  const queryClient = useQueryClient();

  const requirementsList = toArray(requirements);
  const paginationMeta = getPaginationMeta(requirements);
  const visibleRequirements = requirementsList.slice(0, visibleCount);
  const hasMoreLocal = visibleCount < requirementsList.length;
  const hasMoreFromApi = paginationMeta.hasMore === true || (typeof paginationMeta.total === "number" && visibleCount < paginationMeta.total);
  const hasMore = hasMoreLocal || hasMoreFromApi;
  const shownCount = Math.min(visibleCount, requirementsList.length);
  const totalCount = paginationMeta.total ?? requirementsList.length;
  const skillCategories = toArray<{ skills?: string[] }>(skillsData);
  const allSkills = skillCategories.flatMap((cat) => Array.isArray(cat.skills) ? cat.skills : []);

  const resetPagination = () => setVisibleCount(PAGE_SIZE);
  const setSearchFilter = (value: string) => { setSearch(value); resetPagination(); };
  const setSkillsFilter = (next: string[]) => { setSelectedSkills(next); resetPagination(); };
  const setLocationFilter = (value: string) => { setLocation(value); resetPagination(); };
  const setRemoteFilter = (value: boolean) => { setRemote(value); resetPagination(); };
  const setStatusFilter = (value: string) => { setStatus(value); resetPagination(); };
  const setSortFilter = (value: "recent" | "deadline" | "budget") => { setSort(value); resetPagination(); };
  const clearFilters = () => { setSearch(""); setSelectedSkills([]); setLocation(""); setRemote(false); setStatus("open"); setSort("recent"); resetPagination(); };
  const activeFiltersCount = (search ? 1 : 0) + (selectedSkills.length > 0 ? 1 : 0) + (location ? 1 : 0) + (remote ? 1 : 0) + (status !== "open" ? 1 : 0);
  const openRequirement = (req: any) => { if (isLoggedIn) navigate(`/requirements/${req.id}`); else setPreviewRequirement(req); };

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-12">
      <aside className="w-full shrink-0 space-y-6 self-start rounded-2xl border bg-card p-4 shadow-sm md:sticky md:top-24 md:w-64 md:border-0 md:bg-transparent md:p-0 md:shadow-none lg:w-72">
        <div className="flex items-center justify-between pb-4 border-b"><h2 className="text-lg font-semibold flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</h2>{activeFiltersCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground">Clear <X className="ml-1 h-3 w-3" /></Button>}</div>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="search">Search</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="search" placeholder="Title or keyword..." className="pl-9" value={search} onChange={(e) => setSearchFilter(e.target.value)} /></div></div>
          <div className="space-y-2"><Label>Skill Required</Label><SkillMultiSelect selected={selectedSkills} onChange={setSkillsFilter} allSkills={allSkills} /></div>
          <div className="space-y-2"><Label htmlFor="location">Location</Label><div className="relative"><MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="location" placeholder="City, Country..." className="pl-9" value={location} onChange={(e) => setLocationFilter(e.target.value)} /></div></div>
          <div className="space-y-2"><Label htmlFor="status">Status</Label><Select value={status} onValueChange={setStatusFilter}><SelectTrigger id="status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="vacant">Vacant (No applicants)</SelectItem></SelectContent></Select></div>
          <div className="space-y-4 pt-2"><div className="flex items-center justify-between"><Label htmlFor="remote-toggle" className="cursor-pointer">Remote OK</Label><Switch id="remote-toggle" checked={remote} onCheckedChange={setRemoteFilter} /></div></div>
        </div>
      </aside>

      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">Training Requirements</h1><p className="text-muted-foreground mt-1">Browse open training opportunities posted by verified institutions.</p></div>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            {user?.role === "vendor" && <Link href="/requirements/new"><Button className="shrink-0">Post Requirement</Button></Link>}
            <div className="flex items-center gap-2"><Label className="hidden lg:block whitespace-nowrap text-sm text-muted-foreground">Sort:</Label><Select value={sort} onValueChange={(v: any) => setSortFilter(v)}><SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Most Recent</SelectItem><SelectItem value="deadline">Closing Soon</SelectItem><SelectItem value="budget">Highest Budget</SelectItem></SelectContent></Select></div>
          </div>
        </div>

        {!isLoading && requirementsList.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Showing <strong className="text-foreground">{shownCount}</strong>{totalCount ? <> of <strong className="text-foreground">{totalCount}</strong></> : null} requirements</span>
            {hasMore && <span>Use Load more to continue browsing.</span>}
          </div>
        )}

        <div className="space-y-4">
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className="p-6"><div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-md shrink-0" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-1/4" /><div className="flex gap-4 pt-3"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-24 rounded-full" /></div></div></div></CardContent></Card>) : visibleRequirements.length ? visibleRequirements.map((req: any) => {
            const expired = hasDeadlinePassed(req.deadline);
            const appStatus = user?.role === "trainer" ? getTrainerApplicationStatus(req) : null;
            return (
              <div key={req.id} className="relative">
                {isAdmin && <div className="absolute top-3 right-3 z-10"><AdminRemoveButton label={`requirement "${req.title}"`} description="This permanently removes this requirement and all applications submitted to it. This cannot be undone." successMessage="Requirement removed." onConfirm={async () => { await deleteRequirement.mutateAsync({ id: req.id }); await queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey(queryParams) }); }} /></div>}
                <Card role="button" tabIndex={0} onClick={() => openRequirement(req)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRequirement(req); } }} className={`hover:shadow-md transition-all group overflow-hidden cursor-pointer ${expired || req.status === "closed" ? "opacity-80" : "hover:border-primary/50"}`}>
                  <div className="flex flex-col sm:flex-row">
                    <div className="p-6 flex-1 flex flex-col gap-4 min-w-0">
                      <div className="flex items-start gap-4 min-w-0"><Avatar className="h-12 w-12 rounded-md border bg-white shrink-0 mt-1"><AvatarImage src={req.vendorLogoUrl} alt={req.vendorName} className="object-contain p-1" /><AvatarFallback className="rounded-md bg-muted text-muted-foreground"><Building className="h-6 w-6" /></AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className={`flex items-start justify-between gap-2 mb-1 ${isAdmin ? "pr-10" : ""}`}><h3 className="font-semibold text-xl truncate group-hover:text-primary transition-colors min-w-0 flex-1">{req.title}</h3><div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">{req.isUrgent && <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"><Zap className="h-3 w-3" /> Urgent</span>}{req.isFeatured && <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"><Star className="h-3 w-3" /> Featured</span>}{isLoggedIn && req.isPrivate && <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"><Lock className="h-3 w-3" /> Private</span>}{isLoggedIn && req.hireThroughUs && <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"><Handshake className="h-3 w-3" /> Hire Through Us</span>}<Badge variant={statusVariant(req)} className="capitalize">{statusLabel(req)}</Badge>{appStatus && <Badge variant="outline" className="capitalize">{String(appStatus).replace(/_/g, " ")}</Badge>}</div></div><p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap"><span className="font-medium text-foreground">{isLoggedIn ? req.vendorName : "Verified vendor"}</span>{isLoggedIn && req.vendorVerified && <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center text-primary cursor-default"><ShieldCheck className="h-3.5 w-3.5" /></span></TooltipTrigger><TooltipContent>This company is verified by Trainers Hive</TooltipContent></Tooltip>}<span>•</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.location || requirementMode(req)} {req.remote && "(Remote Optional)"}</span><span>•</span><span>Posted {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : "recently"}</span></p></div></div>
                      {req.description && <p className="line-clamp-2 text-sm text-muted-foreground">{req.description}</p>}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm pt-2"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /><span className="font-medium bg-primary/5 text-primary px-2 py-0.5 rounded border border-primary/20">{req.skill}</span></div><div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span>{req.durationDays} days duration</span></div><div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /><span className="font-medium text-foreground capitalize">{budgetLabel(req)}</span></div>{isLoggedIn && <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span>{req.applicationCount} Applicants</span></div>}</div>
                    </div>
                    <div className="bg-muted/30 p-6 flex flex-row sm:flex-col items-center sm:justify-center gap-4 border-t sm:border-t-0 sm:border-l sm:w-48 shrink-0"><div className="text-center sm:w-full"><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Deadline</p><p className="font-medium text-foreground">{formatDate(req.deadline)}</p>{expired && <p className="mt-1 text-xs font-semibold text-destructive">Applications closed</p>}</div><Button className="w-full ml-auto sm:ml-0" variant={expired ? "secondary" : "default"} tabIndex={-1}>{isLoggedIn ? "View Details" : "Preview"} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
                  </div>
                </Card>
              </div>
            );
          }) : <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/30 border-dashed"><Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold text-foreground mb-1">No requirements found</h3><p className="text-muted-foreground max-w-md">We couldn't find any training requirements matching your current filters.</p><Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button></div>}
        </div>

        {!isLoading && requirementsList.length > 0 && hasMore && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="lg" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} disabled={!hasMoreLocal && hasMoreFromApi}>
              {!hasMoreLocal && hasMoreFromApi ? "More results available after backend pagination is enabled" : "Load more requirements"}
            </Button>
          </div>
        )}
      </div>
      <GuestPreviewModal requirement={previewRequirement} onClose={() => setPreviewRequirement(null)} />
    </div>
  );
}
