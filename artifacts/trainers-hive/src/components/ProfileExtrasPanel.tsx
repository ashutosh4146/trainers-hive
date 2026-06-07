import React from "react";
import {
  Award,
  BriefcaseBusiness,
  Building2,
  FileText,
  GraduationCap,
  ImagePlus,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Presentation,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

type LinkItem = { label: string; url: string };
type UrlItem = { title: string; url: string; description?: string };
type Patent = { title: string; url?: string; year?: string; description?: string };
type Cert = { title: string; url?: string; description?: string };
type Employment = { company: string; title: string; from?: string; to?: string; current?: boolean; description?: string };
type Education = { degree: string; institute: string; year?: string; description?: string };

type TrainerExtras = {
  mobileNumber?: string;
  dateOfBirth?: string;
  workPermit?: string;
  locality?: string;
  fullAddress?: string;
  onlineProfiles?: LinkItem[];
  workSamples?: UrlItem[];
  publications?: UrlItem[];
  presentations?: UrlItem[];
  patents?: Patent[];
  extraCertifications?: Cert[];
  employmentDetails?: Employment[];
  educationDetails?: Education[];
};

type VendorExtras = {
  mobileNumber?: string;
  locality?: string;
  fullAddress?: string;
  onlineProfiles?: LinkItem[];
};

type ResponseShape = { avatarUrl?: string; logoUrl?: string; profileExtras?: TrainerExtras | VendorExtras };
type Props = { role: "trainer" | "vendor"; id: string };
type ModalType =
  | "contact"
  | "onlineProfiles"
  | "workSamples"
  | "publications"
  | "presentations"
  | "patents"
  | "certifications"
  | "employment"
  | "education";

const emptyTrainer: TrainerExtras = {
  onlineProfiles: [],
  workSamples: [],
  publications: [],
  presentations: [],
  patents: [],
  extraCertifications: [],
  employmentDetails: [],
  educationDetails: [],
};
const emptyVendor: VendorExtras = { onlineProfiles: [] };

function listCount(value?: unknown[]) {
  return Array.isArray(value) ? value.length : 0;
}

function itemSummary(items?: Array<{ title?: string; label?: string; company?: string; degree?: string }>) {
  if (!items?.length) return "Not added yet";
  const first = items[0];
  return first.title || first.label || first.company || first.degree || `${items.length} item${items.length === 1 ? "" : "s"}`;
}

function normalizeUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;
}

function TextField({ label, value, setValue, placeholder, type = "text" }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function AreaField({ label, value, setValue, placeholder, rows = 3 }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SectionRow({ title, description, count, summary, onAdd, icon }: { title: string; description: string; count?: number; summary?: string; onAdd: () => void; icon: React.ReactNode }) {
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
          {summary && <p className="mt-1 truncate text-xs text-primary">{summary}</p>}
        </div>
      </div>
      <Button type="button" variant="ghost" className="shrink-0 font-semibold text-primary" onClick={onAdd}>{count ? "Edit" : "Add"}</Button>
    </div>
  );
}

function ModalShell({ title, description, children, onClose, onSave, saving }: { title: string; description: string; children: React.ReactNode; onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background p-5 md:p-6">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
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

export function ProfileExtrasPanel({ role, id }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [modal, setModal] = React.useState<ModalType | null>(null);
  const [imageUrl, setImageUrl] = React.useState("");
  const [extras, setExtras] = React.useState<TrainerExtras | VendorExtras>(role === "trainer" ? emptyTrainer : emptyVendor);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const endpoint = role === "trainer" ? `/api/trainers/${id}/profile-extras` : `/api/vendors/${id}/profile-extras`;
  const trainerExtras = extras as TrainerExtras;
  const onlineProfiles = extras.onlineProfiles ?? [];

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    customFetch<ResponseShape>(endpoint)
      .then((data) => {
        if (!mounted) return;
        setImageUrl(data.avatarUrl || data.logoUrl || "");
        setExtras({ ...(role === "trainer" ? emptyTrainer : emptyVendor), ...(data.profileExtras ?? {}) });
      })
      .catch(() => toast({ title: "Could not load profile details", variant: "destructive" }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [endpoint, role, toast]);

  const savePayload = async (nextExtras = extras, nextImageUrl = imageUrl) => {
    setSaving(true);
    try {
      await customFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify(role === "trainer" ? { avatarUrl: nextImageUrl.trim(), profileExtras: nextExtras } : { logoUrl: nextImageUrl.trim(), profileExtras: nextExtras }),
      });
      setExtras(nextExtras);
      setImageUrl(nextImageUrl);
      setModal(null);
      setDraft({});
      toast({ title: "Profile details saved" });
    } catch (error) {
      toast({ title: "Could not save profile details", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openModal = (type: ModalType) => {
    setModal(type);
    setDraft({
      mobileNumber: extras.mobileNumber || "",
      dateOfBirth: trainerExtras.dateOfBirth || "",
      workPermit: trainerExtras.workPermit || "",
      locality: extras.locality || "",
      fullAddress: extras.fullAddress || "",
      imageUrl,
      label: "",
      title: "",
      url: "",
      description: "",
      year: "",
      company: "",
      roleTitle: "",
      from: "",
      to: "",
      degree: "",
      institute: "",
    });
  };

  const appendAndSave = (key: keyof TrainerExtras | keyof VendorExtras, item: unknown) => {
    const current = Array.isArray((extras as Record<string, unknown>)[key as string]) ? (extras as Record<string, unknown[]>)[key as string] : [];
    savePayload({ ...extras, [key]: [...current, item] });
  };

  const modalTitle: Record<ModalType, string> = {
    contact: role === "trainer" ? "Contact, photo and address" : "Contact, logo and address",
    onlineProfiles: "Online profile",
    workSamples: "Work sample",
    publications: "White paper / Research publication / Journal entry",
    presentations: "Presentation",
    patents: "Patent",
    certifications: "Certification",
    employment: "Employment details",
    education: "Education details",
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal === "contact") {
      return (
        <ModalShell title={modalTitle[modal]} description="Update contact and location details used for internal coordination." onClose={() => setModal(null)} onSave={() => savePayload({ ...extras, mobileNumber: draft.mobileNumber, locality: draft.locality, fullAddress: draft.fullAddress, ...(role === "trainer" ? { dateOfBirth: draft.dateOfBirth, workPermit: draft.workPermit } : {}) }, draft.imageUrl)} saving={saving}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={role === "trainer" ? "Profile photo URL" : "Company logo URL"} value={draft.imageUrl || ""} setValue={(v) => setDraft({ ...draft, imageUrl: v })} placeholder="https://..." />
            <TextField label="Mobile number" value={draft.mobileNumber || ""} setValue={(v) => setDraft({ ...draft, mobileNumber: v })} placeholder="+91..." />
            {role === "trainer" && <TextField type="date" label="Date of birth" value={draft.dateOfBirth || ""} setValue={(v) => setDraft({ ...draft, dateOfBirth: v })} />}
            {role === "trainer" && <TextField label="Work permit" value={draft.workPermit || ""} setValue={(v) => setDraft({ ...draft, workPermit: v })} placeholder="India, UAE, US H1B, etc." />}
            <TextField label="Locality" value={draft.locality || ""} setValue={(v) => setDraft({ ...draft, locality: v })} placeholder="Mansarovar, Jaipur" />
            <div className="md:col-span-2"><AreaField label="Full address" value={draft.fullAddress || ""} setValue={(v) => setDraft({ ...draft, fullAddress: v })} placeholder="Full address for internal coordination" /></div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "onlineProfiles") {
      return (
        <ModalShell title="Online profile" description="Add link to online professional profiles, for example LinkedIn, GitHub, Behance, or portfolio." onClose={() => setModal(null)} onSave={() => appendAndSave("onlineProfiles", { label: draft.label || "Profile", url: normalizeUrl(draft.url || "") })} saving={saving}>
          <TextField label="Profile title" value={draft.label || ""} setValue={(v) => setDraft({ ...draft, label: v })} placeholder="LinkedIn, GitHub, Portfolio" />
          <TextField label="URL" value={draft.url || ""} setValue={(v) => setDraft({ ...draft, url: v })} placeholder="https://..." />
        </ModalShell>
      );
    }

    if (modal === "employment") {
      return (
        <ModalShell title="Employment details" description="Add past or current employment details." onClose={() => setModal(null)} onSave={() => appendAndSave("employmentDetails", { company: draft.company, title: draft.roleTitle, from: draft.from, to: draft.to, current: (draft.to || "").toLowerCase() === "present", description: draft.description })} saving={saving}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Company" value={draft.company || ""} setValue={(v) => setDraft({ ...draft, company: v })} />
            <TextField label="Job title" value={draft.roleTitle || ""} setValue={(v) => setDraft({ ...draft, roleTitle: v })} />
            <TextField label="From" value={draft.from || ""} setValue={(v) => setDraft({ ...draft, from: v })} placeholder="Jan 2022" />
            <TextField label="To" value={draft.to || ""} setValue={(v) => setDraft({ ...draft, to: v })} placeholder="Present" />
            <div className="md:col-span-2"><AreaField label="Description" value={draft.description || ""} setValue={(v) => setDraft({ ...draft, description: v })} /></div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "education") {
      return (
        <ModalShell title="Education details" description="Add degree, institute, and completion year." onClose={() => setModal(null)} onSave={() => appendAndSave("educationDetails", { degree: draft.degree, institute: draft.institute, year: draft.year, description: draft.description })} saving={saving}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Degree" value={draft.degree || ""} setValue={(v) => setDraft({ ...draft, degree: v })} />
            <TextField label="Institute" value={draft.institute || ""} setValue={(v) => setDraft({ ...draft, institute: v })} />
            <TextField label="Year" value={draft.year || ""} setValue={(v) => setDraft({ ...draft, year: v })} />
            <div className="md:col-span-2"><AreaField label="Description" value={draft.description || ""} setValue={(v) => setDraft({ ...draft, description: v })} /></div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "patents") {
      return (
        <ModalShell title="Patent" description="Add details of patents you have filed." onClose={() => setModal(null)} onSave={() => appendAndSave("patents", { title: draft.title, year: draft.year, url: normalizeUrl(draft.url || ""), description: draft.description })} saving={saving}>
          <TextField label="Patent title" value={draft.title || ""} setValue={(v) => setDraft({ ...draft, title: v })} />
          <TextField label="Year" value={draft.year || ""} setValue={(v) => setDraft({ ...draft, year: v })} />
          <TextField label="URL optional" value={draft.url || ""} setValue={(v) => setDraft({ ...draft, url: v })} placeholder="https://..." />
          <AreaField label="Description" value={draft.description || ""} setValue={(v) => setDraft({ ...draft, description: v })} />
        </ModalShell>
      );
    }

    const keyMap: Record<Exclude<ModalType, "contact" | "onlineProfiles" | "employment" | "education" | "patents">, keyof TrainerExtras> = {
      workSamples: "workSamples",
      publications: "publications",
      presentations: "presentations",
      certifications: "extraCertifications",
    };
    const descriptionMap: Record<string, string> = {
      workSamples: "Link relevant work samples, for example GitHub, Behance, or project demos.",
      publications: "Add links to online publications, papers, or journal entries.",
      presentations: "Add links to online presentations, for example Slideshare or deck links.",
      certifications: "Add details of certifications you have completed.",
    };

    return (
      <ModalShell title={modalTitle[modal]} description={descriptionMap[modal]} onClose={() => setModal(null)} onSave={() => appendAndSave(keyMap[modal as keyof typeof keyMap], { title: draft.title, url: normalizeUrl(draft.url || ""), description: draft.description })} saving={saving}>
        <TextField label="Title" value={draft.title || ""} setValue={(v) => setDraft({ ...draft, title: v })} placeholder="Enter title" />
        <TextField label="URL" value={draft.url || ""} setValue={(v) => setDraft({ ...draft, url: v })} placeholder="https://..." />
        <AreaField label="Description" value={draft.description || ""} setValue={(v) => setDraft({ ...draft, description: v })} rows={5} placeholder="Type here..." />
      </ModalShell>
    );
  };

  if (loading) {
    return <Card className="border-primary/10"><CardHeader><CardTitle>Profile details</CardTitle><CardDescription>Loading details…</CardDescription></CardHeader><CardContent><div className="h-40 animate-pulse rounded-xl bg-muted" /></CardContent></Card>;
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Additional profile details</CardTitle>
            <CardDescription>Everything stays inside the profile page. Click Add to open a clean popup form.</CardDescription>
          </div>
          <Badge variant="outline">{role === "trainer" ? "Trainer" : "Vendor"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h3 className="mb-2 text-lg font-bold">Contact and address</h3>
          <SectionRow title={role === "trainer" ? "Mobile, DOB, work permit, address and photo" : "Mobile, address and logo"} description="Manage contact details, location, full address, and profile image/logo." count={[extras.mobileNumber, extras.locality, extras.fullAddress, imageUrl].filter(Boolean).length} summary={extras.mobileNumber || extras.locality || undefined} onAdd={() => openModal("contact")} icon={role === "trainer" ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />} />
        </section>

        <section>
          <h3 className="mb-2 text-lg font-bold">Accomplishments</h3>
          <SectionRow title="Online profile" description="Add link to online professional profiles, for example LinkedIn, GitHub, etc." count={listCount(onlineProfiles)} summary={itemSummary(onlineProfiles)} onAdd={() => openModal("onlineProfiles")} icon={<Link2 className="h-5 w-5" />} />
          {role === "trainer" && (
            <>
              <SectionRow title="Work sample" description="Link relevant work samples, for example GitHub or Behance." count={listCount(trainerExtras.workSamples)} summary={itemSummary(trainerExtras.workSamples)} onAdd={() => openModal("workSamples")} icon={<ImagePlus className="h-5 w-5" />} />
              <SectionRow title="White paper / Research publication / Journal entry" description="Add links to your online publications." count={listCount(trainerExtras.publications)} summary={itemSummary(trainerExtras.publications)} onAdd={() => openModal("publications")} icon={<FileText className="h-5 w-5" />} />
              <SectionRow title="Presentation" description="Add links to online presentations, for example slide-share presentation links." count={listCount(trainerExtras.presentations)} summary={itemSummary(trainerExtras.presentations)} onAdd={() => openModal("presentations")} icon={<Presentation className="h-5 w-5" />} />
              <SectionRow title="Patent" description="Add details of patents you have filed." count={listCount(trainerExtras.patents)} summary={itemSummary(trainerExtras.patents)} onAdd={() => openModal("patents")} icon={<ShieldCheck className="h-5 w-5" />} />
              <SectionRow title="Certification" description="Add details of certifications you have completed." count={listCount(trainerExtras.extraCertifications)} summary={itemSummary(trainerExtras.extraCertifications)} onAdd={() => openModal("certifications")} icon={<Award className="h-5 w-5" />} />
            </>
          )}
        </section>

        {role === "trainer" && (
          <section>
            <h3 className="mb-2 text-lg font-bold">Experience and education</h3>
            <SectionRow title="Employment details" description="Add current or past work experience details." count={listCount(trainerExtras.employmentDetails)} summary={itemSummary(trainerExtras.employmentDetails)} onAdd={() => openModal("employment")} icon={<BriefcaseBusiness className="h-5 w-5" />} />
            <SectionRow title="Education" description="Add education, institute, and completion details." count={listCount(trainerExtras.educationDetails)} summary={itemSummary(trainerExtras.educationDetails)} onAdd={() => openModal("education")} icon={<GraduationCap className="h-5 w-5" />} />
          </section>
        )}
      </CardContent>
      {renderModal()}
    </Card>
  );
}
