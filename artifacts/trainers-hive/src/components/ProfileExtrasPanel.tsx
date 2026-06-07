import React from "react";
import { BriefcaseBusiness, Building2, GraduationCap, ImagePlus, Link2, Loader2, MapPin, Phone, Save, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

type LinkItem = { label: string; url: string };
type WorkSample = { title: string; url: string; fromYear?: string; fromMonth?: string; toYear?: string; toMonth?: string; current?: boolean; description?: string };
type Presentation = { title: string; url: string; description?: string };
type Patent = { title: string; url?: string; year?: string; description?: string };
type Employment = { company: string; title: string; from?: string; to?: string; current?: boolean; description?: string };
type Education = { degree: string; institute: string; year?: string; description?: string };

type TrainerExtras = {
  mobileNumber?: string;
  dateOfBirth?: string;
  workPermit?: string;
  locality?: string;
  fullAddress?: string;
  onlineProfiles?: LinkItem[];
  workSamples?: WorkSample[];
  presentations?: Presentation[];
  patents?: Patent[];
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

type Props = {
  role: "trainer" | "vendor";
  id: string;
};

const emptyTrainer: TrainerExtras = {
  onlineProfiles: [],
  workSamples: [],
  presentations: [],
  patents: [],
  employmentDetails: [],
  educationDetails: [],
};

const emptyVendor: VendorExtras = { onlineProfiles: [] };

function csvToLinks(value: string): LinkItem[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, ...rest] = line.split("|");
    const fallback = label?.trim() || "Profile";
    return { label: rest.length ? fallback : fallback.replace(/^https?:\/\//, ""), url: (rest.length ? rest.join("|") : label || "").trim() };
  }).filter((item) => item.url);
}

function linksToText(items?: LinkItem[]) {
  return (items ?? []).map((item) => `${item.label} | ${item.url}`).join("\n");
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function toWorkSamples(value: string): WorkSample[] {
  return splitLines(value).map((line) => {
    const [title = "", url = "", description = ""] = line.split("|").map((part) => part.trim());
    return { title, url, description };
  }).filter((item) => item.title && item.url);
}

function toPresentations(value: string): Presentation[] {
  return splitLines(value).map((line) => {
    const [title = "", url = "", description = ""] = line.split("|").map((part) => part.trim());
    return { title, url, description };
  }).filter((item) => item.title && item.url);
}

function toPatents(value: string): Patent[] {
  return splitLines(value).map((line) => {
    const [title = "", year = "", url = "", description = ""] = line.split("|").map((part) => part.trim());
    return { title, year, url, description };
  }).filter((item) => item.title);
}

function toEmployment(value: string): Employment[] {
  return splitLines(value).map((line) => {
    const [company = "", title = "", from = "", to = "", description = ""] = line.split("|").map((part) => part.trim());
    return { company, title, from, to, current: to.toLowerCase() === "present", description };
  }).filter((item) => item.company && item.title);
}

function toEducation(value: string): Education[] {
  return splitLines(value).map((line) => {
    const [degree = "", institute = "", year = "", description = ""] = line.split("|").map((part) => part.trim());
    return { degree, institute, year, description };
  }).filter((item) => item.degree && item.institute);
}

function workSamplesText(items?: WorkSample[]) { return (items ?? []).map((i) => [i.title, i.url, i.description].filter(Boolean).join(" | ")).join("\n"); }
function presentationsText(items?: Presentation[]) { return (items ?? []).map((i) => [i.title, i.url, i.description].filter(Boolean).join(" | ")).join("\n"); }
function patentsText(items?: Patent[]) { return (items ?? []).map((i) => [i.title, i.year, i.url, i.description].filter(Boolean).join(" | ")).join("\n"); }
function employmentText(items?: Employment[]) { return (items ?? []).map((i) => [i.company, i.title, i.from, i.current ? "Present" : i.to, i.description].filter(Boolean).join(" | ")).join("\n"); }
function educationText(items?: Education[]) { return (items ?? []).map((i) => [i.degree, i.institute, i.year, i.description].filter(Boolean).join(" | ")).join("\n"); }

export function ProfileExtrasPanel({ role, id }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState("");
  const [mobileNumber, setMobileNumber] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [workPermit, setWorkPermit] = React.useState("");
  const [locality, setLocality] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [onlineProfiles, setOnlineProfiles] = React.useState("");
  const [workSamples, setWorkSamples] = React.useState("");
  const [presentations, setPresentations] = React.useState("");
  const [patents, setPatents] = React.useState("");
  const [employment, setEmployment] = React.useState("");
  const [education, setEducation] = React.useState("");

  const endpoint = role === "trainer" ? `/api/trainers/${id}/profile-extras` : `/api/vendors/${id}/profile-extras`;

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    customFetch<ResponseShape>(endpoint)
      .then((data) => {
        if (!mounted) return;
        const extras = (data.profileExtras ?? (role === "trainer" ? emptyTrainer : emptyVendor)) as TrainerExtras;
        setImageUrl(data.avatarUrl || data.logoUrl || "");
        setMobileNumber(extras.mobileNumber || "");
        setDateOfBirth(extras.dateOfBirth || "");
        setWorkPermit(extras.workPermit || "");
        setLocality(extras.locality || "");
        setFullAddress(extras.fullAddress || "");
        setOnlineProfiles(linksToText(extras.onlineProfiles));
        setWorkSamples(workSamplesText(extras.workSamples));
        setPresentations(presentationsText(extras.presentations));
        setPatents(patentsText(extras.patents));
        setEmployment(employmentText(extras.employmentDetails));
        setEducation(educationText(extras.educationDetails));
      })
      .catch(() => toast({ title: "Could not load extended profile details", variant: "destructive" }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [endpoint, role, toast]);

  const save = async () => {
    setSaving(true);
    const base = {
      mobileNumber: mobileNumber.trim(),
      locality: locality.trim(),
      fullAddress: fullAddress.trim(),
      onlineProfiles: csvToLinks(onlineProfiles),
    };
    const trainerOnly: TrainerExtras = {
      ...base,
      dateOfBirth: dateOfBirth.trim(),
      workPermit: workPermit.trim(),
      workSamples: toWorkSamples(workSamples),
      presentations: toPresentations(presentations),
      patents: toPatents(patents),
      employmentDetails: toEmployment(employment),
      educationDetails: toEducation(education),
    };
    const vendorOnly: VendorExtras = base;
    try {
      await customFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify(role === "trainer" ? { avatarUrl: imageUrl.trim(), profileExtras: trainerOnly } : { logoUrl: imageUrl.trim(), profileExtras: vendorOnly }),
      });
      toast({ title: "Extended profile saved" });
    } catch (error) {
      toast({ title: "Could not save extended profile", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="border-primary/10"><CardHeader><CardTitle>Extended profile</CardTitle><CardDescription>Loading details…</CardDescription></CardHeader><CardContent><div className="h-40 animate-pulse rounded-xl bg-muted" /></CardContent></Card>;
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Extended profile details</CardTitle>
            <CardDescription>Add profile information similar to job portals: contact, address, online work, patents, employment, and education.</CardDescription>
          </div>
          <Badge variant="outline">{role === "trainer" ? "Trainer" : "Vendor"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
              {imageUrl ? <img src={imageUrl} alt="Profile preview" className="h-full w-full object-cover" /> : role === "trainer" ? <UserRound className="h-12 w-12 text-muted-foreground" /> : <Building2 className="h-12 w-12 text-muted-foreground" />}
            </div>
            <Label>{role === "trainer" ? "Profile photo URL" : "Company logo URL"}</Label>
            <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Contact and address</h3></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Mobile number</Label><Input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="+91..." /></div>
                {role === "trainer" && <div className="space-y-1.5"><Label>Date of birth</Label><Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></div>}
                {role === "trainer" && <div className="space-y-1.5"><Label>Work permit</Label><Input value={workPermit} onChange={(event) => setWorkPermit(event.target.value)} placeholder="India, UAE, US H1B, etc." /></div>}
                <div className="space-y-1.5"><Label>Locality</Label><Input value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Mansarovar, Jaipur" /></div>
                <div className="space-y-1.5 md:col-span-2"><Label>Full address</Label><Textarea rows={3} value={fullAddress} onChange={(event) => setFullAddress(event.target.value)} placeholder="Full address for internal coordination" /></div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Online profiles</h3></div>
              <Textarea rows={4} value={onlineProfiles} onChange={(event) => setOnlineProfiles(event.target.value)} placeholder="GitHub | https://github.com/yourname&#10;LinkedIn | https://linkedin.com/in/yourname" />
              <p className="text-xs text-muted-foreground">One per line. Format: Label | URL</p>
            </section>

            {role === "trainer" && (
              <>
                <section className="space-y-4"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Employment details</h3></div><Textarea rows={4} value={employment} onChange={(event) => setEmployment(event.target.value)} placeholder="Company | Title | From | To/Present | Description" /></section>
                <section className="space-y-4"><div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Education</h3></div><Textarea rows={4} value={education} onChange={(event) => setEducation(event.target.value)} placeholder="Degree | Institute | Year | Description" /></section>
                <section className="space-y-4"><div className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Work samples</h3></div><Textarea rows={4} value={workSamples} onChange={(event) => setWorkSamples(event.target.value)} placeholder="Project title | URL | Description" /></section>
                <section className="space-y-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Presentations</h3></div><Textarea rows={4} value={presentations} onChange={(event) => setPresentations(event.target.value)} placeholder="Presentation title | URL | Description" /></section>
                <section className="space-y-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Patents</h3></div><Textarea rows={4} value={patents} onChange={(event) => setPatents(event.target.value)} placeholder="Patent title | Year | URL | Description" /></section>
              </>
            )}

            <div className="flex justify-end border-t pt-5">
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save extended details
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
