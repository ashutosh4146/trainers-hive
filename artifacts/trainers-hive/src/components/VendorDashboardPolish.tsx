import React from "react";
import { Link } from "wouter";
import {
  getListAgreementPaymentsQueryKey,
  getListMyAgreementsQueryKey,
  useDeleteAgreementPayment,
  useGetVendor,
  useGetVendorHiringStats,
  useGetVendorStats,
  useListAgreementPayments,
  useListMyAgreements,
  useListRequirements,
  useRecordAgreementPayment,
  useUpdateAgreementPayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  ClipboardList,
  Clock,
  CreditCard,
  FileSignature,
  FileText,
  History,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type RequirementFilter = "all" | "open" | "closed" | "withApplicants" | "needsAction";

type PaymentTarget = {
  id: string;
  counterpartyName: string;
  requirementTitle: string;
  requirementId?: string;
  agreedFee?: number | null;
  paidAmount?: number | null;
};

function money(value: number | null | undefined) {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureInputDate(value: string) {
  return !!value && value > todayInputValue();
}

function normalizeAmountInput(value: string) {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d+\.\d{0,2}).*$/, "$1");
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusTone(status: string) {
  if (status === "open") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800";
  if (status === "closed") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700";
  if (status === "draft") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";
  return "bg-muted text-muted-foreground border-border";
}

function KpiCard({ title, value, icon, description, href, emphasis }: { title: string; value: React.ReactNode; icon: React.ReactNode; description?: string; href?: string; emphasis?: boolean }) {
  const body = (
    <Card className={cn("h-full transition-all hover:border-primary/40 hover:shadow-sm", emphasis && "border-primary/30 bg-primary/5")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold leading-none tracking-tight">{value}</p>
            {description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ActionCard({ title, description, href, icon, cta, tone = "default", onClick }: { title: string; description: string; href?: string; icon: React.ReactNode; cta: string; tone?: "default" | "primary"; onClick?: () => void }) {
  const body = (
    <div className={cn("rounded-xl border p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm", tone === "primary" ? "bg-primary/5" : "bg-background")}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">{cta} <ArrowRight className="h-3.5 w-3.5" /></p>
        </div>
      </div>
    </div>
  );
  if (onClick) return <button type="button" className="block w-full" onClick={onClick}>{body}</button>;
  return <Link href={href ?? "#"}>{body}</Link>;
}

function RequirementCard({ req }: { req: any }) {
  const deadline = parseDate(req.deadline);
  const applicationCount = Number(req.applicationCount ?? 0);
  const isDueSoon = deadline ? deadline.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7 : false;

  return (
    <Link href={`/requirements/${req.id}`}>
      <div className="rounded-xl border bg-background p-4 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">{req.title}</h3>
              <Badge variant="outline" className={cn("capitalize", statusTone(req.status))}>{req.status}</Badge>
              {applicationCount > 0 && <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{applicationCount} applicants</Badge>}
              {isDueSoon && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Due soon</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border bg-muted/30 px-2.5 py-1">{req.skill || "Skill not set"}</span>
              <span className="rounded-full border bg-muted/30 px-2.5 py-1">{req.remote ? "Remote allowed" : req.location || "Location not set"}</span>
              <span className="rounded-full border bg-muted/30 px-2.5 py-1">{req.durationDays ?? "—"} days</span>
              <span className="rounded-full border bg-muted/30 px-2.5 py-1">{money(req.budget)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center lg:w-[270px]">
            <div className="rounded-lg border bg-muted/20 px-2 py-2"><p className="text-base font-bold">{applicationCount}</p><p className="text-[10px] text-muted-foreground">applicants</p></div>
            <div className="rounded-lg border bg-muted/20 px-2 py-2"><p className="truncate text-base font-bold">{deadline ? format(deadline, "MMM d") : "—"}</p><p className="text-[10px] text-muted-foreground">deadline</p></div>
            <div className="rounded-lg border bg-muted/20 px-2 py-2"><p className="text-base font-bold">{req.status === "open" ? "Live" : "Closed"}</p><p className="text-[10px] text-muted-foreground">status</p></div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function matchesFilter(req: any, filter: RequirementFilter) {
  if (filter === "all") return true;
  if (filter === "open") return req.status === "open";
  if (filter === "closed") return req.status === "closed";
  if (filter === "withApplicants") return Number(req.applicationCount ?? 0) > 0;
  if (filter === "needsAction") return req.status === "open" && Number(req.applicationCount ?? 0) > 0;
  return true;
}

function MiniPagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function AmountInput({ id, value, onChange, required = true }: { id?: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      value={value}
      onChange={(event) => onChange(normalizeAmountInput(event.target.value))}
      placeholder="0"
      required={required}
    />
  );
}

function RecordPaymentDialog({ target, open, onOpenChange, onSuccess }: { target: PaymentTarget | null; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const mutation = useRecordAgreementPayment();
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayInputValue());
  const [note, setNote] = React.useState("");
  const outstanding = target ? Math.max(0, Number(target.agreedFee ?? 0) - Number(target.paidAmount ?? 0)) : 0;

  React.useEffect(() => {
    if (open) {
      setAmount(outstanding > 0 ? String(outstanding) : "");
      setPaidAt(todayInputValue());
      setNote("");
    }
  }, [open, outstanding]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return toast({ title: "Enter a valid payment amount", variant: "destructive" });
    if (isFutureInputDate(paidAt)) return toast({ title: "Future payment dates are not allowed", description: "Use today's date or an earlier date.", variant: "destructive" });
    try {
      await mutation.mutateAsync({ agreementId: target.id, data: { amount: parsed, paidAt, note: note.trim() || null } });
      toast({ title: "Payment recorded" });
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Could not record payment", description: "Please try again.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {target ? `For ${target.counterpartyName} · ${target.requirementTitle}` : "Record a payment against this agreement."}
            {target && <span className="mt-1 block">Outstanding: <strong>{money(outstanding)}</strong></span>}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5"><Label htmlFor="vendor-payment-amount">Amount</Label><AmountInput id="vendor-payment-amount" value={amount} onChange={setAmount} /></div>
          <div className="space-y-1.5"><Label htmlFor="vendor-payment-date">Payment date</Label><Input id="vendor-payment-date" type="date" max={todayInputValue()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required /><p className="text-xs text-muted-foreground">Future dates are blocked.</p></div>
          <div className="space-y-1.5"><Label htmlFor="vendor-payment-note">Note optional</Label><Textarea id="vendor-payment-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. First instalment via NEFT" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Record payment"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManagePaymentsDialog({ target, open, onOpenChange, onSuccess }: { target: PaymentTarget | null; open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const agreementId = target?.id ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: payments, isLoading } = useListAgreementPayments(agreementId, { query: { enabled: open && !!agreementId, queryKey: getListAgreementPaymentsQueryKey(agreementId) } });
  const updatePayment = useUpdateAgreementPayment();
  const deletePayment = useDeleteAgreementPayment();
  const [editing, setEditing] = React.useState<any | null>(null);
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayInputValue());
  const [note, setNote] = React.useState("");

  function startEdit(payment: any) {
    setEditing(payment);
    setAmount(String(payment.amount ?? ""));
    setPaidAt(String(payment.paidAt ?? "").slice(0, 10) || todayInputValue());
    setNote(payment.note ?? "");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!target || !editing) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return toast({ title: "Enter a valid payment amount", variant: "destructive" });
    if (isFutureInputDate(paidAt)) return toast({ title: "Future payment dates are not allowed", description: "Use today's date or an earlier date.", variant: "destructive" });
    try {
      await updatePayment.mutateAsync({ agreementId: target.id, paymentId: editing.id, data: { amount: parsed, paidAt, note: note.trim() || null } });
      toast({ title: "Payment updated" });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: getListAgreementPaymentsQueryKey(target.id) });
      onSuccess();
    } catch {
      toast({ title: "Could not update payment", variant: "destructive" });
    }
  }

  async function removePayment(payment: any) {
    if (!target || !window.confirm("Remove this recorded payment?")) return;
    try {
      await deletePayment.mutateAsync({ agreementId: target.id, paymentId: payment.id });
      toast({ title: "Payment removed" });
      await queryClient.invalidateQueries({ queryKey: getListAgreementPaymentsQueryKey(target.id) });
      onSuccess();
    } catch {
      toast({ title: "Could not remove payment", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Payment history</DialogTitle><DialogDescription>{target ? `${target.counterpartyName} · ${target.requirementTitle}` : "Manage recorded payments."}</DialogDescription></DialogHeader>
        {editing && (
          <form className="rounded-xl border bg-muted/20 p-4 space-y-3" onSubmit={saveEdit}>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Amount</Label><AmountInput value={amount} onChange={setAmount} /></div><div className="space-y-1.5"><Label>Payment date</Label><Input type="date" max={todayInputValue()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required /></div></div>
            <div className="space-y-1.5"><Label>Note optional</Label><Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel edit</Button><Button type="submit" disabled={updatePayment.isPending}>{updatePayment.isPending ? "Saving…" : "Save changes"}</Button></div>
          </form>
        )}
        <div className="space-y-2">
          {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : !payments?.length ? <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</div> : payments.map((payment: any) => (
            <div key={payment.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{money(payment.amount)}</p><p className="text-xs text-muted-foreground">{parseDate(payment.paidAt) ? format(parseDate(payment.paidAt)!, "MMM d, yyyy") : "No date"}{payment.note ? ` · ${payment.note}` : ""}</p></div>
              <div className="flex gap-1"><Button type="button" size="icon" variant="outline" title="Edit payment" aria-label="Edit payment" onClick={() => startEdit(payment)}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" title="Remove payment" aria-label="Remove payment" className="text-destructive hover:text-destructive" disabled={deletePayment.isPending} onClick={() => removePayment(payment)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VendorDashboardPolish({ vendorId }: { vendorId: string }) {
  const queryClient = useQueryClient();
  const { data: vendor } = useGetVendor(vendorId);
  const { data: stats, isLoading: statsLoading } = useGetVendorStats();
  const { data: hiringStats, isLoading: hiringLoading } = useGetVendorHiringStats(vendorId);
  const { data: requirements, isLoading: reqsLoading } = useListRequirements({ vendorId });
  const { data: agreements, isLoading: agreementsLoading } = useListMyAgreements({ query: { queryKey: getListMyAgreementsQueryKey() } });
  const [filter, setFilter] = React.useState<RequirementFilter>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [paymentPage, setPaymentPage] = React.useState(1);
  const [paymentTarget, setPaymentTarget] = React.useState<PaymentTarget | null>(null);
  const [managePaymentTarget, setManagePaymentTarget] = React.useState<PaymentTarget | null>(null);

  const reqs = requirements ?? [];
  const signedAgreements = (agreements ?? []).filter((agreement: any) => agreement.status === "accepted");
  const totalCommitted = signedAgreements.reduce((sum: number, agreement: any) => sum + Number(agreement.agreedFee ?? 0), 0);
  const totalPaid = signedAgreements.reduce((sum: number, agreement: any) => sum + Number(agreement.paidAmount ?? 0), 0);
  const totalOutstanding = Math.max(0, totalCommitted - totalPaid);

  const scrollToPipeline = React.useCallback(() => { setFilter("needsAction"); window.setTimeout(() => document.getElementById("vendor-requirements")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }, []);
  const counts = React.useMemo(() => ({ all: reqs.length, open: reqs.filter((req: any) => req.status === "open").length, closed: reqs.filter((req: any) => req.status === "closed").length, withApplicants: reqs.filter((req: any) => Number(req.applicationCount ?? 0) > 0).length, needsAction: reqs.filter((req: any) => req.status === "open" && Number(req.applicationCount ?? 0) > 0).length }), [reqs]);
  const filteredReqs = React.useMemo(() => { const q = search.trim().toLowerCase(); return reqs.filter((req: any) => matchesFilter(req, filter)).filter((req: any) => !q || [req.title, req.skill, req.location, req.status].some((value) => String(value ?? "").toLowerCase().includes(q))).sort((a: any, b: any) => Number(b.applicationCount ?? 0) - Number(a.applicationCount ?? 0) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()); }, [reqs, filter, search]);

  React.useEffect(() => setPage(1), [filter, search]);
  React.useEffect(() => setPaymentPage(1), [signedAgreements.length]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredReqs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredReqs.slice((safePage - 1) * pageSize, safePage * pageSize);
  const paymentsPageSize = 4;
  const paymentTotalPages = Math.max(1, Math.ceil(signedAgreements.length / paymentsPageSize));
  const safePaymentPage = Math.min(paymentPage, paymentTotalPages);
  const paymentItems = signedAgreements.slice((safePaymentPage - 1) * paymentsPageSize, safePaymentPage * paymentsPageSize);
  const applicantCount = reqs.reduce((sum: number, req: any) => sum + Number(req.applicationCount ?? 0), 0);
  const averageTimeLabel = hiringLoading ? "Loading" : hiringStats?.hiredCount ? `${hiringStats.avgDays} days` : "No hires yet";
  const refreshPayments = () => void queryClient.invalidateQueries({ queryKey: getListMyAgreementsQueryKey() });

  if (statsLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><div className="grid gap-4 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-80 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 md:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Vendor dashboard</Badge>{vendor?.verified && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verified</Badge>}</div><h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{vendor?.companyName || "Vendor workspace"}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Manage requirements, review applicants, move trainers through shortlist and hire, and keep spend under control.</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href="/requirements/new"><Plus className="mr-2 h-4 w-4" /> Post requirement</Link></Button><Button asChild variant="outline"><Link href="/messages"><MessageSquare className="mr-2 h-4 w-4" /> Messages</Link></Button><Button asChild variant="outline"><Link href="/agreements"><FileSignature className="mr-2 h-4 w-4" /> Agreements</Link></Button></div></div></section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5"><KpiCard title="Open requirements" value={stats?.openRequirements ?? counts.open} icon={<Briefcase className="h-5 w-5" />} href="#vendor-requirements" description="Live opportunities trainers can apply to." emphasis /><KpiCard title="Applications" value={stats?.applicationsReceived ?? applicantCount} icon={<Users className="h-5 w-5" />} href="#vendor-requirements" description="Applicants across your requirements." /><KpiCard title="Need review" value={counts.needsAction} icon={<Clock className="h-5 w-5" />} href="#vendor-requirements" description="Open roles with applicants waiting." emphasis={counts.needsAction > 0} /><KpiCard title="Shortlisted" value={stats?.shortlistedTrainers ?? 0} icon={<Star className="h-5 w-5" />} href="#vendor-requirements" description="Potential trainers in final review." /><KpiCard title="Hired" value={stats?.hiredTrainers ?? 0} icon={<CheckCircle className="h-5 w-5" />} href="#vendor-requirements" description="Selected trainers." /></div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Card id="vendor-requirements" className="border-primary/10"><CardHeader className="space-y-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Requirements pipeline</CardTitle><CardDescription>Prioritize requirements with applicants and move them toward hire.</CardDescription></div><Button asChild size="sm"><Link href="/requirements/new"><Plus className="mr-2 h-4 w-4" /> Post new</Link></Button></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]"><div className="flex flex-wrap gap-2">{([ ["all", "All", counts.all], ["needsAction", "Needs review", counts.needsAction], ["withApplicants", "With applicants", counts.withApplicants], ["open", "Open", counts.open], ["closed", "Closed", counts.closed] ] as [RequirementFilter, string, number][]).map(([value, label, count]) => <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", filter === value ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-primary")}>{label}: {count}</button>)}</div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requirements…" className="pl-9" /></div></div></CardHeader><CardContent>{reqsLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div> : reqs.length === 0 ? <div className="rounded-xl border border-dashed py-12 text-center"><Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><h3 className="font-semibold">No requirements yet</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Post your first training requirement so interested trainers can apply.</p><Button asChild className="mt-4"><Link href="/requirements/new">Post requirement</Link></Button></div> : pageItems.length === 0 ? <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">No requirements match the current filters.<div><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</Button></div></div> : <div className="space-y-3">{pageItems.map((req: any) => <RequirementCard key={req.id} req={req} />)}<MiniPagination page={safePage} totalPages={totalPages} onPage={setPage} /></div>}</CardContent></Card>


        </div>

        <div className="space-y-6"><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Hiring health</CardTitle><CardDescription>Current marketplace momentum for your vendor account.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-xl border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">Average time to hire</p><p className="mt-1 text-2xl font-bold">{averageTimeLabel}</p><p className="mt-1 text-xs text-muted-foreground">{hiringStats?.hiredCount ? `${hiringStats.hiredCount} hired requirements measured` : "Appears after your first hire"}</p></div><div className="rounded-xl border bg-background p-4"><p className="text-xs font-medium text-muted-foreground">Spend outstanding</p><p className="mt-1 text-2xl font-bold">{agreementsLoading ? "…" : money(totalOutstanding)}</p><p className="mt-1 text-xs text-muted-foreground">{signedAgreements.length} signed agreement{signedAgreements.length === 1 ? "" : "s"}</p></div></CardContent></Card><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Recommended actions</CardTitle><CardDescription>Use these to keep your hiring pipeline moving.</CardDescription></CardHeader><CardContent className="space-y-3"><ActionCard title="Review waiting applicants" description="Open requirements with applicants and shortlist or reject quickly." onClick={scrollToPipeline} icon={<Users className="h-5 w-5" />} cta="Review pipeline" tone="primary" /><ActionCard title="Reply to trainer messages" description="Clarify availability, pricing, and delivery plan before hiring." href="/messages" icon={<MessageSquare className="h-5 w-5" />} cta="Open messages" /><ActionCard title="Finalize agreements" description="After hiring, confirm scope, dates, commercials, and payment terms." href="/agreements" icon={<FileSignature className="h-5 w-5" />} cta="View agreements" /></CardContent></Card><Card className="border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Payment snapshot</CardTitle><CardDescription>Quick payment status before the full payment section.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border bg-primary/5 p-3"><p className="truncate text-sm font-bold">{money(totalCommitted)}</p><p className="mt-1 text-[10px] text-muted-foreground">committed</p></div><div className="rounded-xl border p-3"><p className="truncate text-sm font-bold text-emerald-700">{money(totalPaid)}</p><p className="mt-1 text-[10px] text-muted-foreground">paid</p></div><div className="rounded-xl border p-3"><p className="truncate text-sm font-bold text-amber-700">{money(totalOutstanding)}</p><p className="mt-1 text-[10px] text-muted-foreground">due</p></div></div></CardContent></Card></div>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Spend and payments</CardTitle><CardDescription>Committed, paid, outstanding, and payment history controls.</CardDescription></CardHeader><CardContent>{agreementsLoading ? <Skeleton className="h-28 w-full rounded-xl" /> : signedAgreements.length === 0 ? <div className="rounded-xl border border-dashed py-10 text-center"><Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /><p className="font-medium">No signed agreements yet</p><p className="mt-1 text-sm text-muted-foreground">Spend appears after you hire trainers and complete engagement agreements.</p></div> : <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Committed</p><p className="mt-1 text-2xl font-bold">{money(totalCommitted)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="mt-1 text-2xl font-bold text-emerald-700">{money(totalPaid)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-1 text-2xl font-bold text-amber-700">{money(totalOutstanding)}</p></div></div><div className="space-y-2">{paymentItems.map((agreement: any) => { const fee = Number(agreement.agreedFee ?? 0); const paid = Number(agreement.paidAmount ?? 0); const outstanding = Math.max(0, fee - paid); return <div key={agreement.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link href={`/requirements/${agreement.requirementId}`} className="font-medium hover:underline">{agreement.counterpartyName}</Link><p className="truncate text-xs text-muted-foreground">{agreement.requirementTitle}</p><p className="mt-1 text-xs text-muted-foreground">Paid {money(paid)} · Outstanding {money(outstanding)}</p></div><div className="flex gap-1"><Button type="button" size="icon" variant="outline" title="Record payment" aria-label="Record payment" onClick={() => setPaymentTarget(agreement)}><CreditCard className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" title="Payment history" aria-label="Payment history" onClick={() => setManagePaymentTarget(agreement)}><History className="h-4 w-4" /></Button></div></div>; })}</div><MiniPagination page={safePaymentPage} totalPages={paymentTotalPages} onPage={setPaymentPage} /></div>}</CardContent></Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Applications trend</CardTitle><CardDescription>Applications received over time.</CardDescription></CardHeader><CardContent className="h-[280px]">{stats?.applicationsTrend && stats.applicationsTrend.length > 0 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.applicationsTrend}><defs><linearGradient id="vendorApps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), "MMM d")} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} /><Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#vendorApps)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No application trend yet</div>}</CardContent></Card><Card><CardHeader><CardTitle>Skill demand</CardTitle><CardDescription>Skills requested across your requirements.</CardDescription></CardHeader><CardContent className="h-[280px]">{stats?.skillBreakdown && stats.skillBreakdown.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.skillBreakdown} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} /><YAxis dataKey="skill" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} cursor={{ fill: "hsl(var(--muted))" }} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No skill data yet</div>}</CardContent></Card></div>

      <RecordPaymentDialog target={paymentTarget} open={!!paymentTarget} onOpenChange={(open) => { if (!open) setPaymentTarget(null); }} onSuccess={refreshPayments} />
      <ManagePaymentsDialog target={managePaymentTarget} open={!!managePaymentTarget} onOpenChange={(open) => { if (!open) setManagePaymentTarget(null); }} onSuccess={refreshPayments} />
    </div>
  );
}
