import { useState } from "react";
import { Link } from "wouter";
import { useListMyAgreements, getListMyAgreementsQueryKey } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ClipboardList,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  IndianRupee,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  awaiting_trainer: "Awaiting trainer",
  accepted: "Signed",
  cancelled: "Cancelled",
};

const STATUS_HELPER: Record<string, string> = {
  draft: "Agreement is being prepared",
  awaiting_trainer: "Waiting for trainer acceptance",
  accepted: "Ready for records and download",
  cancelled: "Agreement was cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  awaiting_trainer: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

function StatCard({ icon: Icon, label, value, hint }: {
  icon: typeof FileSignature;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ icon: Icon, label, value }: {
  icon: typeof FileSignature;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export default function MyAgreements() {
  const { data, isLoading } = useListMyAgreements({ query: { queryKey: getListMyAgreementsQueryKey() } });
  const [downloading, setDownloading] = useState<string | null>(null);
  const agreements = data ?? [];
  const signedCount = agreements.filter((ag) => ag.status === "accepted").length;
  const pendingCount = agreements.filter((ag) => ag.status === "draft" || ag.status === "awaiting_trainer").length;
  const totalValue = agreements.reduce((sum, ag) => sum + (ag.agreedFee ?? 0), 0);

  async function downloadPdf(agreementId: string, title: string) {
    if (downloading) return;
    setDownloading(agreementId);
    try {
      const token = localStorage.getItem("th_session_token");
      const res = await fetch(`/api/agreements/${agreementId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agreement-${agreementId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not download PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Digital engagement records
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-3">
                  <span className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <FileSignature className="h-6 w-6" />
                  </span>
                  Engagement Agreements
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  View signed, pending, and cancelled training engagement agreements. Trainers Hive stores these records for
                  coordination and documentation; commercial responsibility remains between the vendor and trainer.
                </p>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground lg:max-w-xs">
                <p className="font-medium text-foreground">Need a PDF?</p>
                <p className="mt-1 leading-5">Signed or cancelled agreements can be downloaded from the agreement card.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={ClipboardList} label="Total" value={agreements.length} hint="All engagement records" />
          <StatCard icon={ShieldCheck} label="Signed" value={signedCount} hint="Completed agreements" />
          <StatCard icon={IndianRupee} label="Value" value={fmtCurrency(totalValue)} hint={`${pendingCount} pending`} />
        </div>

        {isLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3 text-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Loading your agreements…</span>
            </CardContent>
          </Card>
        ) : agreements.length === 0 ? (
          <Card className="border-dashed bg-card/70">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold">No agreements yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Engagement agreements will appear here after a vendor starts one with a trainer, or after you initiate one from a requirement.
              </p>
              <Button asChild className="mt-5">
                <Link href="/requirements">Browse requirements</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {agreements.map((ag) => (
              <Card key={ag.id} className="overflow-hidden border-border/70 bg-card/95 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="line-clamp-2 text-lg leading-snug">{ag.requirementTitle}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <UserRound className="h-3.5 w-3.5" />
                        {ag.role === "vendor" ? "Trainer" : "Vendor"}: <strong className="text-foreground">{ag.counterpartyName}</strong>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`w-fit whitespace-nowrap ${STATUS_COLOR[ag.status] ?? ""}`}>
                      {STATUS_LABEL[ag.status] ?? ag.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InfoTile icon={IndianRupee} label="Fee" value={fmtCurrency(ag.agreedFee)} />
                    <InfoTile icon={CalendarDays} label="Start date" value={fmtDate(ag.startDate)} />
                    <InfoTile icon={CalendarDays} label="End date" value={fmtDate(ag.endDate)} />
                  </div>

                  <div className="rounded-xl border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {STATUS_HELPER[ag.status] ?? "Agreement status updated"}
                  </div>

                  <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/requirements/${ag.requirementId}`}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open requirement
                      </Link>
                    </Button>
                    {(ag.status === "accepted" || ag.status === "cancelled") && (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={downloading === ag.id}
                        onClick={() => downloadPdf(ag.id, ag.requirementTitle)}
                      >
                        {downloading === ag.id
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Downloading…</>
                          : <><Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF</>}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
