import { useState } from "react";
import { Link } from "wouter";
import { useListMyAgreements, getListMyAgreementsQueryKey } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, Download, ExternalLink, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  awaiting_trainer: "Awaiting trainer",
  accepted: "Signed",
  cancelled: "Cancelled",
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

export default function MyAgreements() {
  const { data, isLoading } = useListMyAgreements({ query: { queryKey: getListMyAgreementsQueryKey() } });
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadPdf(agreementId: string, title: string) {
    if (downloading) return;
    setDownloading(agreementId);
    try {
      const token = await auth.currentUser?.getIdToken();
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
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" /> Engagement Agreements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Digital agreements between vendors and trainers. Trainers Hive is a facilitator only.
        </p>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 flex items-center justify-center text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          No engagement agreements yet. They'll appear here once a vendor starts one with you (or vice versa).
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data.map((ag) => (
            <Card key={ag.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{ag.requirementTitle}</CardTitle>
                    <CardDescription className="mt-0.5">
                      {ag.role === "vendor" ? "Trainer" : "Vendor"}: <strong className="text-foreground">{ag.counterpartyName}</strong>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_COLOR[ag.status]}>
                    {STATUS_LABEL[ag.status] ?? ag.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Fee</div>
                    <div>{ag.agreedFee != null ? `₹${ag.agreedFee.toLocaleString("en-IN")}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Start</div>
                    <div>{fmtDate(ag.startDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">End</div>
                    <div>{fmtDate(ag.endDate)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/requirements/${ag.requirementId}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open requirement
                    </Link>
                  </Button>
                  {(ag.status === "accepted" || ag.status === "cancelled") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloading === ag.id}
                      onClick={() => downloadPdf(ag.id, ag.requirementTitle)}
                    >
                      {downloading === ag.id
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Downloading…</>
                        : <><Download className="h-3.5 w-3.5 mr-1.5" /> PDF</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
