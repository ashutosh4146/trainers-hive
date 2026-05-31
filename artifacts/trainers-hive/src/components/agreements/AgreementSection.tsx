import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetApplicationAgreement,
  getGetApplicationAgreementQueryKey,
  useUpdateAgreementTerms,
  useSubmitAgreementToTrainer,
  useAcceptAgreement,
  useRequestAgreementChanges,
  useCancelAgreement,
  getListMyAgreementsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileSignature,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  RefreshCcw,
  XCircle,
  ShieldCheck,
} from "lucide-react";

interface Props {
  applicationId: string;
  role: "vendor" | "trainer";
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  awaiting_trainer: "Awaiting trainer",
  accepted: "Signed by both parties",
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

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AgreementSection({ applicationId, role }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = getGetApplicationAgreementQueryKey(applicationId);

  const { data: agreement, isLoading, error, refetch } = useGetApplicationAgreement(applicationId, {
    query: { queryKey, retry: false },
  });

  const updateMut = useUpdateAgreementTerms();
  const submitMut = useSubmitAgreementToTrainer();
  const acceptMut = useAcceptAgreement();
  const requestChangesMut = useRequestAgreementChanges();
  const cancelMut = useCancelAgreement();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    agreedFee: "" as string,
    paymentSchedule: "",
    travelBoarding: "",
    cancellationNotice: "",
    startDate: "",
    endDate: "",
    sessionsCount: "" as string,
    locationOrMode: "",
    deliverables: "",
    confidentialityClause: true,
    ipOwnership: "",
    governingLawCity: "Mumbai",
    specialClauses: "",
  });

  useEffect(() => {
    if (agreement) {
      setForm({
        agreedFee: agreement.agreedFee != null ? String(agreement.agreedFee) : "",
        paymentSchedule: agreement.paymentSchedule ?? "",
        travelBoarding: agreement.travelBoarding ?? "",
        cancellationNotice: agreement.cancellationNotice ?? "",
        startDate: agreement.startDate ?? "",
        endDate: agreement.endDate ?? "",
        sessionsCount: agreement.sessionsCount != null ? String(agreement.sessionsCount) : "",
        locationOrMode: agreement.locationOrMode ?? "",
        deliverables: agreement.deliverables ?? "",
        confidentialityClause: agreement.confidentialityClause,
        ipOwnership: agreement.ipOwnership ?? "",
        governingLawCity: agreement.governingLawCity ?? "Mumbai",
        specialClauses: agreement.specialClauses ?? "",
      });
    }
  }, [agreement]);

  const [vendorConfirmOpen, setVendorConfirmOpen] = useState(false);
  const [trainerAcceptOpen, setTrainerAcceptOpen] = useState(false);
  const [trainerAccepted, setTrainerAccepted] = useState(false);
  const [vendorAccepted, setVendorAccepted] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: getListMyAgreementsQueryKey() });
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading engagement agreement…
        </CardContent>
      </Card>
    );
  }

  if (error || !agreement) {
    if (role === "vendor") {
      return (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" /> Engagement agreement
            </CardTitle>
            <CardDescription>
              Create a digital engagement agreement to formalize the hire. Once you submit, the trainer can accept or request changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} size="sm">
              <FileSignature className="h-4 w-4 mr-1.5" /> Start agreement
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 text-sm text-muted-foreground">
          The vendor has not started an engagement agreement yet.
        </CardContent>
      </Card>
    );
  }

  const status = agreement.status;
  const canVendorEdit = role === "vendor" && status === "draft";
  const canVendorSubmit = role === "vendor" && status === "draft";
  const canTrainerAct = role === "trainer" && status === "awaiting_trainer";
  const canCancel = status !== "cancelled" && status !== "accepted";
  const isFinal = status === "accepted" || status === "cancelled";

  const onSaveDraft = () => {
    updateMut.mutate(
      {
        id: agreement.id,
        data: {
          agreedFee: form.agreedFee.trim() === "" ? null : Number(form.agreedFee),
          paymentSchedule: form.paymentSchedule || null,
          travelBoarding: form.travelBoarding || null,
          cancellationNotice: form.cancellationNotice || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          sessionsCount: form.sessionsCount.trim() === "" ? null : Number(form.sessionsCount),
          locationOrMode: form.locationOrMode || null,
          deliverables: form.deliverables || null,
          confidentialityClause: form.confidentialityClause,
          ipOwnership: form.ipOwnership || null,
          governingLawCity: form.governingLawCity || "Mumbai",
          specialClauses: form.specialClauses || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Draft saved" });
          setEditing(false);
          invalidate();
        },
        onError: () => toast({ title: "Could not save", variant: "destructive" }),
      },
    );
  };

  const onVendorSubmit = () => {
    submitMut.mutate(
      { id: agreement.id },
      {
        onSuccess: () => {
          toast({ title: "Agreement sent to trainer", description: "We've notified them by email." });
          setVendorConfirmOpen(false);
          setVendorAccepted(false);
          invalidate();
        },
        onError: () => toast({ title: "Could not submit", variant: "destructive" }),
      },
    );
  };

  const onTrainerAccept = () => {
    acceptMut.mutate(
      { id: agreement.id },
      {
        onSuccess: () => {
          toast({ title: "Agreement accepted", description: "Both parties have signed. The PDF is available to download." });
          setTrainerAcceptOpen(false);
          setTrainerAccepted(false);
          invalidate();
        },
        onError: () => toast({ title: "Could not accept", variant: "destructive" }),
      },
    );
  };

  const onTrainerRequestChanges = () => {
    if (!requestNote.trim()) return;
    requestChangesMut.mutate(
      { id: agreement.id, data: { note: requestNote.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Change request sent" });
          setRequestOpen(false);
          setRequestNote("");
          invalidate();
        },
        onError: () => toast({ title: "Could not send", variant: "destructive" }),
      },
    );
  };

  const onCancel = () => {
    cancelMut.mutate(
      { id: agreement.id, data: { reason: cancelReason.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Agreement cancelled" });
          setCancelOpen(false);
          setCancelReason("");
          invalidate();
        },
        onError: () => toast({ title: "Could not cancel", variant: "destructive" }),
      },
    );
  };

  const counterparty = role === "vendor" ? agreement.trainerName : agreement.vendorName;

  const downloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const token = localStorage.getItem("th_session_token");
      const res = await fetch(`/api/agreements/${agreement.id}/pdf`, {
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
      a.download = `agreement-${agreement.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" /> Engagement agreement
            </CardTitle>
            <CardDescription className="mt-1">
              Between <strong>{agreement.vendorName}</strong> and <strong>{agreement.trainerName}</strong> for "{agreement.requirementTitle}"
            </CardDescription>
          </div>
          <Badge variant="outline" className={STATUS_COLOR[status]}>
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {agreement.changesRequestedNote && status === "draft" && role === "vendor" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm">
            <div className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-4 w-4" /> {counterparty} requested changes
            </div>
            <div className="text-amber-900/90 dark:text-amber-200/90 whitespace-pre-wrap">{agreement.changesRequestedNote}</div>
          </div>
        )}

        {status === "awaiting_trainer" && role === "vendor" && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">
            Sent to {counterparty} on {fmtDateTime(agreement.vendorAcceptedAt)}. Waiting for their acceptance.
          </div>
        )}

        {status === "accepted" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Signed by both parties</div>
              <div className="mt-1 text-xs">
                Vendor accepted {fmtDateTime(agreement.vendorAcceptedAt)} · Trainer accepted {fmtDateTime(agreement.trainerAcceptedAt)}
              </div>
            </div>
          </div>
        )}

        {status === "cancelled" && (
          <div className="rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 p-3 text-sm text-rose-900 dark:text-rose-200">
            Cancelled on {fmtDateTime(agreement.cancelledAt)}{agreement.cancellationReason ? `: ${agreement.cancellationReason}` : "."}
          </div>
        )}

        {/* View / edit body */}
        {canVendorEdit && editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ag-fee">Agreed fee (₹)</Label>
              <Input id="ag-fee" type="number" inputMode="numeric" value={form.agreedFee}
                onChange={e => setForm(f => ({ ...f, agreedFee: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-sessions">Sessions / days</Label>
              <Input id="ag-sessions" type="number" inputMode="numeric" value={form.sessionsCount}
                onChange={e => setForm(f => ({ ...f, sessionsCount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-start">Start date</Label>
              <Input id="ag-start" type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-end">End date</Label>
              <Input id="ag-end" type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-location">Location / mode</Label>
              <Input id="ag-location" value={form.locationOrMode}
                onChange={e => setForm(f => ({ ...f, locationOrMode: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-deliverables">Deliverables</Label>
              <Textarea id="ag-deliverables" rows={2} value={form.deliverables}
                onChange={e => setForm(f => ({ ...f, deliverables: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-pay">Payment schedule</Label>
              <Input id="ag-pay" value={form.paymentSchedule}
                onChange={e => setForm(f => ({ ...f, paymentSchedule: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-travel">Travel & boarding</Label>
              <Input id="ag-travel" value={form.travelBoarding}
                onChange={e => setForm(f => ({ ...f, travelBoarding: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-cancel">Cancellation notice</Label>
              <Input id="ag-cancel" value={form.cancellationNotice}
                onChange={e => setForm(f => ({ ...f, cancellationNotice: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-ip">IP ownership</Label>
              <Textarea id="ag-ip" rows={2} value={form.ipOwnership}
                onChange={e => setForm(f => ({ ...f, ipOwnership: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-law">Governing law (city)</Label>
              <Input id="ag-law" value={form.governingLawCity}
                onChange={e => setForm(f => ({ ...f, governingLawCity: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2 pt-1">
              <Checkbox id="ag-conf" checked={form.confidentialityClause}
                onCheckedChange={(v) => setForm(f => ({ ...f, confidentialityClause: !!v }))} />
              <Label htmlFor="ag-conf" className="text-sm font-normal cursor-pointer">
                Both parties agree to keep all materials, learner data and engagement details confidential.
              </Label>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ag-special">Special clauses (optional)</Label>
              <Textarea id="ag-special" rows={2} value={form.specialClauses}
                onChange={e => setForm(f => ({ ...f, specialClauses: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={updateMut.isPending}>Cancel</Button>
              <Button size="sm" onClick={onSaveDraft} disabled={updateMut.isPending}>
                {updateMut.isPending ? "Saving…" : "Save draft"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <Field label="Fee" value={agreement.agreedFee != null ? `₹${agreement.agreedFee.toLocaleString("en-IN")}` : "To be discussed"} />
            <Field label="Sessions / days" value={agreement.sessionsCount != null ? String(agreement.sessionsCount) : "—"} />
            <Field label="Start date" value={fmtDate(agreement.startDate)} />
            <Field label="End date" value={fmtDate(agreement.endDate)} />
            <Field label="Location / mode" value={agreement.locationOrMode || "—"} className="sm:col-span-2" />
            <Field label="Deliverables" value={agreement.deliverables || "—"} className="sm:col-span-2" multiline />
            <Field label="Payment schedule" value={agreement.paymentSchedule || "—"} className="sm:col-span-2" />
            <Field label="Travel & boarding" value={agreement.travelBoarding || "—"} className="sm:col-span-2" />
            <Field label="Cancellation notice" value={agreement.cancellationNotice || "—"} className="sm:col-span-2" />
            <Field label="IP ownership" value={agreement.ipOwnership || "—"} className="sm:col-span-2" multiline />
            <Field label="Governing law" value={`Courts of ${agreement.governingLawCity}, India`} />
            <Field label="Confidentiality" value={agreement.confidentialityClause ? "Both parties agree" : "Not applicable"} />
            {agreement.specialClauses && (
              <Field label="Special clauses" value={agreement.specialClauses} className="sm:col-span-2" multiline />
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {canVendorEdit && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit terms</Button>
          )}
          {canVendorSubmit && !editing && (
            <Button size="sm" onClick={() => setVendorConfirmOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Send to trainer
            </Button>
          )}
          {canTrainerAct && (
            <>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setTrainerAcceptOpen(true)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Accept agreement
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Request changes
              </Button>
            </>
          )}
          {isFinal && (
            <Button size="sm" variant="outline" onClick={downloadPdf} disabled={downloadingPdf}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> {downloadingPdf ? "Downloading…" : "Download PDF"}
            </Button>
          )}
          {canCancel && !editing && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel agreement
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Trainers Hive is a facilitator only and is not a party to this agreement. Acceptance is recorded with timestamps and IP addresses
          and constitutes a valid electronic contract under the Information Technology Act, 2000.
        </p>
      </CardContent>

      {/* Vendor submit confirmation */}
      <Dialog open={vendorConfirmOpen} onOpenChange={(o) => { if (!o) { setVendorConfirmOpen(false); setVendorAccepted(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send agreement to {counterparty}?</DialogTitle>
            <DialogDescription>
              By clicking "I accept and send", you electronically sign these terms on behalf of <strong>{agreement.vendorName}</strong>.
              We will record your IP address and timestamp as evidence under Section 65B of the Indian Evidence Act.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 py-2">
            <Checkbox id="ag-vendor-accept" checked={vendorAccepted} onCheckedChange={(v) => setVendorAccepted(!!v)} />
            <Label htmlFor="ag-vendor-accept" className="text-sm font-normal cursor-pointer">
              I have read the terms above and accept them on behalf of {agreement.vendorName}.
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVendorConfirmOpen(false)}>Cancel</Button>
            <Button disabled={!vendorAccepted || submitMut.isPending} onClick={onVendorSubmit}>
              {submitMut.isPending ? "Sending…" : "I accept and send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trainer accept */}
      <Dialog open={trainerAcceptOpen} onOpenChange={(o) => { if (!o) { setTrainerAcceptOpen(false); setTrainerAccepted(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this engagement agreement?</DialogTitle>
            <DialogDescription>
              By clicking "I accept", you electronically sign these terms with <strong>{agreement.vendorName}</strong>.
              Your IP address and timestamp will be recorded as evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 py-2">
            <Checkbox id="ag-trainer-accept" checked={trainerAccepted} onCheckedChange={(v) => setTrainerAccepted(!!v)} />
            <Label htmlFor="ag-trainer-accept" className="text-sm font-normal cursor-pointer">
              I have read the terms above and accept them.
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTrainerAcceptOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!trainerAccepted || acceptMut.isPending} onClick={onTrainerAccept}>
              {acceptMut.isPending ? "Accepting…" : "I accept"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trainer request changes */}
      <Dialog open={requestOpen} onOpenChange={(o) => { if (!o) setRequestOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>Tell {agreement.vendorName} what needs to change. The agreement will go back to draft.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} placeholder="e.g. Please increase the fee to ₹X and add a 15-day cancellation notice."
            value={requestNote} onChange={(e) => setRequestNote(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button onClick={onTrainerRequestChanges} disabled={!requestNote.trim() || requestChangesMut.isPending}>
              {requestChangesMut.isPending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!o) setCancelOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this agreement?</DialogTitle>
            <DialogDescription>The other party will be notified. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} placeholder="Optional reason"
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep agreement</Button>
            <Button variant="destructive" onClick={onCancel} disabled={cancelMut.isPending}>
              {cancelMut.isPending ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value, className, multiline }: { label: string; value: string; className?: string; multiline?: boolean }) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm text-foreground ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</div>
    </div>
  );
}
