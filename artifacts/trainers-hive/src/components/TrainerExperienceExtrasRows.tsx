import React from "react";
import { BriefcaseBusiness, GraduationCap, Loader2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

type Employment = { company: string; title: string; from?: string; to?: string; current?: boolean; description?: string };
type Education = { degree: string; institute: string; year?: string; description?: string };
type TrainerExtras = { employmentDetails?: Employment[]; educationDetails?: Education[]; [key: string]: unknown };
type ResponseShape = { avatarUrl?: string; profileExtras?: TrainerExtras };
type ModalType = "employment" | "education";

function itemSummary(items?: Array<{ company?: string; degree?: string; title?: string }>) {
  if (!items?.length) return "Not added yet";
  const first = items[0];
  return first.company || first.degree || first.title || `${items.length} item${items.length === 1 ? "" : "s"}`;
}

function SectionRow({ title, description, count, summary, onAdd, icon }: { title: string; description: string; count: number; summary: string; onAdd: () => void; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-5 last:border-b-0">
      <div className="flex min-w-0 gap-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {!!count && <Badge variant="outline">{count}</Badge>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <p className="mt-1 truncate text-xs text-primary">{summary}</p>
        </div>
      </div>
      <Button type="button" variant="ghost" className="shrink-0 font-semibold text-primary" onClick={onAdd}>{count ? "Edit" : "Add"}</Button>
    </div>
  );
}

function Field({ label, value, setValue, placeholder }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} /></div>;
}

function Modal({ title, description, children, onClose, onSave, saving }: { title: string; description: string; children: React.ReactNode; onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background p-5 md:p-6">
          <div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-5 p-5 md:p-6">{children}</div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background p-5 md:p-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
        </div>
      </div>
    </div>
  );
}

export function TrainerExperienceExtrasRows({ trainerId }: { trainerId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [extras, setExtras] = React.useState<TrainerExtras>({ employmentDetails: [], educationDetails: [] });
  const [modal, setModal] = React.useState<ModalType | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    customFetch<ResponseShape>(`/api/trainers/${trainerId}/profile-extras`)
      .then((data) => {
        if (!mounted) return;
        setAvatarUrl(data.avatarUrl || "");
        setExtras({ employmentDetails: [], educationDetails: [], ...(data.profileExtras ?? {}) });
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [trainerId]);

  const saveExtras = async (next: TrainerExtras) => {
    setSaving(true);
    try {
      await customFetch(`/api/trainers/${trainerId}/profile-extras`, {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl, profileExtras: next }),
      });
      setExtras(next);
      setModal(null);
      setDraft({});
      toast({ title: "Experience details saved" });
    } catch (error) {
      toast({ title: "Could not save experience details", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const open = (type: ModalType) => {
    setModal(type);
    setDraft({ company: "", roleTitle: "", from: "", to: "", degree: "", institute: "", year: "", description: "" });
  };

  const addEmployment = () => saveExtras({
    ...extras,
    employmentDetails: [...(extras.employmentDetails ?? []), { company: draft.company, title: draft.roleTitle, from: draft.from, to: draft.to, current: (draft.to || "").toLowerCase() === "present", description: draft.description }],
  });

  const addEducation = () => saveExtras({
    ...extras,
    educationDetails: [...(extras.educationDetails ?? []), { degree: draft.degree, institute: draft.institute, year: draft.year, description: draft.description }],
  });

  if (loading) return <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Loading employment and education details…</div>;

  return (
    <div className="rounded-2xl border bg-background p-5">
      <div className="mb-1 flex items-center gap-2">
        <BriefcaseBusiness className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Employment and education</h3>
      </div>
      <p className="text-sm text-muted-foreground">These are now merged into the Experience and proof section.</p>
      <SectionRow title="Employment details" description="Add current or past work experience details." count={(extras.employmentDetails ?? []).length} summary={itemSummary(extras.employmentDetails)} onAdd={() => open("employment")} icon={<BriefcaseBusiness className="h-5 w-5" />} />
      <SectionRow title="Education" description="Add education, institute, and completion details." count={(extras.educationDetails ?? []).length} summary={itemSummary(extras.educationDetails)} onAdd={() => open("education")} icon={<GraduationCap className="h-5 w-5" />} />

      {modal === "employment" && <Modal title="Employment details" description="Add past or current employment details." onClose={() => setModal(null)} onSave={addEmployment} saving={saving}><div className="grid gap-4 md:grid-cols-2"><Field label="Company" value={draft.company || ""} setValue={(v) => setDraft({ ...draft, company: v })} /><Field label="Job title" value={draft.roleTitle || ""} setValue={(v) => setDraft({ ...draft, roleTitle: v })} /><Field label="From" value={draft.from || ""} setValue={(v) => setDraft({ ...draft, from: v })} placeholder="Jan 2022" /><Field label="To" value={draft.to || ""} setValue={(v) => setDraft({ ...draft, to: v })} placeholder="Present" /><div className="md:col-span-2"><Label>Description</Label><Textarea rows={4} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div></div></Modal>}
      {modal === "education" && <Modal title="Education details" description="Add degree, institute, and completion year." onClose={() => setModal(null)} onSave={addEducation} saving={saving}><div className="grid gap-4 md:grid-cols-2"><Field label="Degree" value={draft.degree || ""} setValue={(v) => setDraft({ ...draft, degree: v })} /><Field label="Institute" value={draft.institute || ""} setValue={(v) => setDraft({ ...draft, institute: v })} /><Field label="Year" value={draft.year || ""} setValue={(v) => setDraft({ ...draft, year: v })} /><div className="md:col-span-2"><Label>Description</Label><Textarea rows={4} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div></div></Modal>}
    </div>
  );
}
