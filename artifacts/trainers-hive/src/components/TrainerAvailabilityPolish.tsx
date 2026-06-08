import React from "react";
import {
  getGetCurrentUserQueryKey,
  getGetTrainerQueryKey,
  useGetTrainer,
  useUpdateTrainer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CalendarCheck2, CalendarDays, CalendarPlus, Check, Clock3, Info, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type EngagedRange = { startDate: string; endDate: string; note?: string };

function parseLocalDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRange(range: EngagedRange) {
  const start = parseLocalDate(range.startDate);
  const end = parseLocalDate(range.endDate);
  if (!start || !end) return `${range.startDate} → ${range.endDate}`;
  return `${format(start, "MMM d, yyyy")} → ${format(end, "MMM d, yyyy")}`;
}

function daysInRange(range: EngagedRange) {
  const start = parseLocalDate(range.startDate);
  const end = parseLocalDate(range.endDate);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function rangesOverlap(a: EngagedRange, b: EngagedRange) {
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

function SummaryTile({ label, value, helper, icon }: { label: string; value: React.ReactNode; helper: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      </div>
    </div>
  );
}

export function TrainerAvailabilityPolish({ trainerId }: { trainerId: string }) {
  const { data: trainer, isLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const updateTrainer = useUpdateTrainer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [note, setNote] = React.useState("");
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editStart, setEditStart] = React.useState("");
  const [editEnd, setEditEnd] = React.useState("");
  const [editNote, setEditNote] = React.useState("");

  const engaged: EngagedRange[] = React.useMemo(() => {
    const raw = (trainer as { engagedDates?: EngagedRange[] } | undefined)?.engagedDates;
    return Array.isArray(raw) ? raw : [];
  }, [trainer]);

  const keyed = React.useMemo(() => engaged.map((range, index) => ({ range, index, key: `${range.startDate}-${range.endDate}-${index}` })), [engaged]);
  const sorted = React.useMemo(() => [...keyed].sort((a, b) => a.range.startDate.localeCompare(b.range.startDate)), [keyed]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeUpcoming = sorted.map((item) => item.range).filter((range) => range.endDate >= todayIso);
  const totalBlockedDays = activeUpcoming.reduce((sum, range) => sum + daysInRange(range), 0);
  const nextBooking = activeUpcoming[0];

  const persist = (next: EngagedRange[], successTitle: string) => {
    updateTrainer.mutate(
      { id: trainerId, data: { engagedDates: next } },
      {
        onSuccess: () => {
          toast({ title: successTitle });
          setEditingKey(null);
          queryClient.invalidateQueries({ queryKey: getGetTrainerQueryKey(trainerId) });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not save your availability", variant: "destructive" });
        },
      },
    );
  };

  const validateRange = (candidate: EngagedRange, otherRanges: EngagedRange[]) => {
    if (!candidate.startDate || !candidate.endDate) {
      toast({ title: "Pick both dates", description: "Start and end dates are required.", variant: "destructive" });
      return false;
    }
    if (candidate.endDate < candidate.startDate) {
      toast({ title: "Invalid range", description: "End date must be on or after start date.", variant: "destructive" });
      return false;
    }
    if (candidate.startDate < todayIso || candidate.endDate < todayIso) {
      toast({ title: "Invalid range", description: "Booked periods must be today or later.", variant: "destructive" });
      return false;
    }
    const overlaps = otherRanges.some((range) => rangesOverlap(candidate, range));
    if (overlaps) {
      toast({ title: "Dates overlap", description: "This period overlaps with an existing engaged range.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const candidate: EngagedRange = { startDate: start, endDate: end, ...(note.trim() ? { note: note.trim() } : {}) };
    if (!validateRange(candidate, engaged)) return;
    persist([...engaged, candidate], "Engaged dates added");
    setStart("");
    setEnd("");
    setNote("");
  };

  const handleRemove = (index: number) => {
    persist(engaged.filter((_, itemIndex) => itemIndex !== index), "Engaged dates removed");
  };

  const beginEdit = (range: EngagedRange, key: string) => {
    setEditingKey(key);
    setEditStart(range.startDate);
    setEditEnd(range.endDate);
    setEditNote(range.note ?? "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditStart("");
    setEditEnd("");
    setEditNote("");
  };

  const saveEdit = (index: number) => {
    const candidate: EngagedRange = { startDate: editStart, endDate: editEnd, ...(editNote.trim() ? { note: editNote.trim() } : {}) };
    const otherRanges = engaged.filter((_, itemIndex) => itemIndex !== index);
    if (!validateRange(candidate, otherRanges)) return;
    const next = engaged.map((range, itemIndex) => (itemIndex === index ? candidate : range));
    persist(next, "Booked period updated");
  };

  if (isLoading) {
    return (
      <Card className="mt-6 border-primary/10">
        <CardHeader><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader>
        <CardContent><Skeleton className="h-56 w-full rounded-xl" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 overflow-hidden border-primary/10">
      <CardHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Set availability — engaged dates</CardTitle>
                {activeUpcoming.length > 0 ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Booked</Badge> : <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Available</Badge>}
              </div>
              <CardDescription className="mt-1 max-w-2xl">
                Block dates when you are already committed. Vendors can see these dates and overlapping applications are prevented.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryTile label="Upcoming periods" value={activeUpcoming.length} helper="Engagement ranges from today onward." icon={<CalendarCheck2 className="h-5 w-5" />} />
          <SummaryTile label="Blocked days" value={totalBlockedDays} helper="Total days blocked by active ranges." icon={<Clock3 className="h-5 w-5" />} />
          <SummaryTile label="Next booking" value={nextBooking ? formatRange(nextBooking).split(" → ")[0] : "None"} helper={nextBooking?.note || "No upcoming blocked dates."} icon={<Info className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <form onSubmit={handleAdd} className="rounded-2xl border bg-background p-4 md:p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Add engaged period</h3>
              <p className="mt-1 text-sm text-muted-foreground">Use this for confirmed client work, workshops, travel, or other unavailable days.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="engaged-start">Start date</Label>
                <Input id="engaged-start" type="date" value={start} min={todayIso} onChange={(event) => setStart(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="engaged-end">End date</Label>
                <Input id="engaged-end" type="date" value={end} min={start || todayIso} onChange={(event) => setEnd(event.target.value)} required />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="engaged-note">Note optional</Label>
                <Textarea id="engaged-note" rows={3} placeholder="e.g. Client workshop, travel, internal training" value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} />
                <p className="text-xs text-muted-foreground">Keep notes short. Vendors see the blocked dates, not private details.</p>
              </div>
            </div>
            <Button type="submit" disabled={updateTrainer.isPending} className="mt-4 w-full sm:w-auto">
              <CalendarPlus className="mr-2 h-4 w-4" />
              {updateTrainer.isPending ? "Saving…" : "Add engaged period"}
            </Button>
          </form>

          <div className="rounded-2xl border bg-muted/20 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Availability rules</h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>• Dates must be today or later.</li>
                  <li>• End date cannot be before start date.</li>
                  <li>• Overlapping engaged periods are blocked.</li>
                  <li>• Edit or remove a period when your availability changes.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Your booked periods</h3>
              <p className="text-sm text-muted-foreground">Keep this list accurate before applying to new requirements.</p>
            </div>
            <Badge variant="outline">{sorted.length} total</Badge>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
              <CalendarCheck2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold">No engaged dates yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">You are currently shown as available for upcoming requirements. Add dates when a confirmed engagement blocks your calendar.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sorted.map(({ range, index, key }) => {
                const isEditing = editingKey === key;
                return (
                  <div key={key} className="rounded-2xl border bg-background p-4 transition-colors hover:border-primary/40">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-start-${key}`}>Start date</Label>
                            <Input id={`edit-start-${key}`} type="date" value={editStart} min={todayIso} onChange={(event) => setEditStart(event.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`edit-end-${key}`}>End date</Label>
                            <Input id={`edit-end-${key}`} type="date" value={editEnd} min={editStart || todayIso} onChange={(event) => setEditEnd(event.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-note-${key}`}>Note optional</Label>
                          <Textarea id={`edit-note-${key}`} rows={3} value={editNote} maxLength={120} onChange={(event) => setEditNote(event.target.value)} />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={updateTrainer.isPending}>
                            <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button type="button" size="sm" onClick={() => saveEdit(index)} disabled={updateTrainer.isPending}>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> {updateTrainer.isPending ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{formatRange(range)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{daysInRange(range)} day{daysInRange(range) === 1 ? "" : "s"} blocked</p>
                          {range.note && <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{range.note}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => beginEdit(range, key)} disabled={updateTrainer.isPending} aria-label="Edit booked period" title="Edit booked period">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(index)} disabled={updateTrainer.isPending} aria-label="Remove engaged dates" title="Remove engaged dates">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
