import { useAuth } from "@/hooks/useAuth";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetCurrentUser,
  useGetVendor,
  useGetVendorStats,
  useGetTrainerStats,
  useGetPlatformStats,
  useListRequirements,
  useListMyApplications,
  useListRecentRequirements,
  useListHireInquiries,
  useDeleteRequirement,
  useUnflagRequirement,
  useHideRequirement,
  useUnhideRequirement,
  useWarnRequirementVendor,
  useGetVendorHiringStats,
  useListSavedTrainers,
  useUnsaveTrainer,
  useListVendorEndorsements,
  useUpdateTrainerEndorsement,
  useDeleteTrainerEndorsement,
  getListVendorEndorsementsQueryKey,
  useGetTrainer,
  useListAdminUsers,
  useDeactivateUser,
  useReactivateUser,
  useWithdrawApplication,
  useListAdminVendors,
  useVerifyVendor,
  useListHireThroughUsRequirements,
  useGetSkillsDemand,
  getListRequirementsQueryKey,
  getListSavedTrainersQueryKey,
  getGetTrainerQueryKey,
  getListAdminUsersQueryKey,
  getListAdminVendorsQueryKey,
  getListMyApplicationsQueryKey,
  useListMyAgreements,
  getListMyAgreementsQueryKey,
  useRecordAgreementPayment,
  useListAgreementPayments,
  getListAgreementPaymentsQueryKey,
  useDeleteAgreementPayment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import {
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Star,
  Eye,
  EyeOff,
  TrendingUp,
  FileText,
  ClipboardList,
  Plus,
  ShieldCheck,
  Flag,
  Trash2,
  MessageSquare,
  Bookmark,
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  Download,
  LogOut,
  ThumbsUp,
  Pencil,
  Mail,
  Phone,
  UserPlus,
  Building,
  Wallet,
  IndianRupee,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MessageThread } from "@/components/MessageThread";

type VerificationRequest = {
  id: string;
  trainerId: string;
  status: string;
  message: string | null;
  adminNote: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  qualification: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  trainer: { id: string; name: string; avatarUrl: string; mainSkill: string } | null;
};

function parseAgreementDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtSpendDate(s: string | null | undefined): string {
  const d = parseAgreementDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

type RecordPaymentDialogProps = {
  agreementId: string;
  counterpartyName: string;
  agreedFee: number | null | undefined;
  paidAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

function RecordPaymentDialog({
  agreementId,
  counterpartyName,
  agreedFee,
  paidAmount,
  open,
  onOpenChange,
  onSuccess,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mutation = useRecordAgreementPayment();

  const outstanding = agreedFee != null ? Math.max(0, agreedFee - paidAmount) : null;

  function handleClose(val: boolean) {
    if (!submitting) {
      onOpenChange(val);
      if (!val) {
        setAmount("");
        setNote("");
        setPaidAt(new Date().toISOString().slice(0, 10));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!paidAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
      toast({ title: "Enter a valid date", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await mutation.mutateAsync({
        agreementId,
        data: { amount: parsedAmount, paidAt, note: note.trim() || null },
      });
      toast({ title: "Payment recorded" });
      onSuccess();
      onOpenChange(false);
      setAmount("");
      setNote("");
      setPaidAt(new Date().toISOString().slice(0, 10));
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment made against the agreement with{" "}
            <span className="font-medium">{counterpartyName}</span>.
            {outstanding != null && (
              <span className="block mt-1 text-sm">
                Outstanding: <span className="font-semibold text-foreground">{fmtINR(outstanding)}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount (INR)</Label>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              placeholder="e.g. 25000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Payment Date</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Textarea
              id="pay-note"
              placeholder="e.g. First instalment via NEFT"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgreementPaymentHistory({
  agreementId,
  canDelete,
  onDeleted,
}: {
  agreementId: string;
  canDelete: boolean;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError } = useListAgreementPayments(agreementId, {
    query: { queryKey: getListAgreementPaymentsQueryKey(agreementId) },
  });
  const deleteMutation = useDeleteAgreementPayment();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync({ agreementId, paymentId: confirmDeleteId });
      toast({ title: "Payment deleted" });
      setConfirmDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: getListAgreementPaymentsQueryKey(agreementId) });
      onDeleted?.();
    } catch {
      toast({ title: "Failed to delete payment", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="pt-2 space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-xs text-destructive pt-2">
        Failed to load payment history. Refresh to try again.
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic pt-2 text-center">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <>
      <div className="pt-2 space-y-0">
        {data.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-3 py-1.5 text-xs ${
              i < data.length - 1 ? "border-b border-border/50" : ""
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground shrink-0">
                {fmtSpendDate(p.paidAt)}
              </span>
              {p.note && (
                <span className="text-muted-foreground truncate">· {p.note}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-emerald-700">
                {fmtINR(p.amount)}
              </span>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete payment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open && !deleting) setConfirmDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment record and update the
              paid/outstanding totals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VendorSpendSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useListMyAgreements({
    query: { queryKey: getListMyAgreementsQueryKey() },
  });
  const [payDialogAgreementId, setPayDialogAgreementId] = useState<string | null>(null);
  const [expandedAgreementId, setExpandedAgreementId] = useState<string | null>(null);

  // "Signed" agreements are those both parties accepted.
  const signed = (data ?? []).filter((a) => a.status === "accepted");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // An engagement is "completed" once its end date has passed; otherwise it's
  // still "active" (including open-ended agreements with no end date).
  const withStatus = signed.map((a) => {
    const end = parseAgreementDate(a.endDate);
    const completed = end != null && end.getTime() < startOfToday.getTime();
    return { ...a, engagement: completed ? ("completed" as const) : ("active" as const) };
  });

  const totalCommitted = withStatus.reduce((s, a) => s + (a.agreedFee ?? 0), 0);
  const totalPaid = withStatus.reduce((s, a) => s + (a.paidAmount ?? 0), 0);
  const totalOutstanding = Math.max(0, totalCommitted - totalPaid);

  const activeAgreement = payDialogAgreementId
    ? withStatus.find((a) => a.id === payDialogAgreementId)
    : null;

  return (
    <Card id="vendor-spend">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Vendor Spend
        </CardTitle>
        <CardDescription>
          Committed spend across your signed engagement agreements
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : isError ? (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-muted-foreground">Couldn't load your spend</p>
            <p className="text-sm text-muted-foreground mt-1">
              There was a problem loading your agreements. Please refresh the page to try again.
            </p>
          </div>
        ) : withStatus.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <Wallet className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
            <p className="font-medium text-muted-foreground">No signed agreements yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once you sign an engagement agreement with a trainer, your committed spend will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 bg-primary/5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IndianRupee className="h-4 w-4" /> Total Committed
                </div>
                <p className="text-2xl font-bold mt-1">{fmtINR(totalCommitted)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {withStatus.length} signed {withStatus.length === 1 ? "agreement" : "agreements"}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /> Paid
                </div>
                <p className="text-2xl font-bold mt-1 text-emerald-700">{fmtINR(totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalCommitted > 0
                    ? `${Math.round((totalPaid / totalCommitted) * 100)}% of committed`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-amber-600" /> Outstanding
                </div>
                <p className="text-2xl font-bold mt-1 text-amber-700">{fmtINR(totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalOutstanding === 0 ? "Fully settled" : "Remaining balance"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Agreement breakdown</p>
              <div className="space-y-2">
                {withStatus.map((a) => {
                  const paid = a.paidAmount ?? 0;
                  const fee = a.agreedFee ?? 0;
                  const outstanding = Math.max(0, fee - paid);
                  const pct = fee > 0 ? Math.min(100, Math.round((paid / fee) * 100)) : 0;
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg border hover:border-primary/30 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/requirements/${a.requirementId}`}
                            className="font-medium text-sm hover:underline truncate block"
                          >
                            {a.counterpartyName}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">{a.requirementTitle}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtSpendDate(a.startDate)} – {fmtSpendDate(a.endDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={
                              a.engagement === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }
                          >
                            {a.engagement === "active" ? "Active" : "Completed"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => setPayDialogAgreementId(a.id)}
                          >
                            + Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 gap-1 text-muted-foreground"
                            onClick={() =>
                              setExpandedAgreementId(
                                expandedAgreementId === a.id ? null : a.id
                              )
                            }
                          >
                            History
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                expandedAgreementId === a.id ? "rotate-180" : ""
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Paid: <span className="font-medium text-emerald-700">{fmtINR(paid)}</span></span>
                          <span>Outstanding: <span className={outstanding > 0 ? "font-medium text-amber-700" : "font-medium text-muted-foreground"}>{fmtINR(outstanding)}</span></span>
                          <span className="font-medium">{fmtINR(fee)}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {expandedAgreementId === a.id && (
                        <div className="border-t pt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Payment history
                          </p>
                          <AgreementPaymentHistory
                            agreementId={a.id}
                            canDelete={true}
                            onDeleted={() => {
                              void queryClient.invalidateQueries({ queryKey: getListMyAgreementsQueryKey() });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {activeAgreement && (
        <RecordPaymentDialog
          agreementId={activeAgreement.id}
          counterpartyName={activeAgreement.counterpartyName}
          agreedFee={activeAgreement.agreedFee}
          paidAmount={activeAgreement.paidAmount ?? 0}
          open={payDialogAgreementId === activeAgreement.id}
          onOpenChange={(open) => { if (!open) setPayDialogAgreementId(null); }}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: getListMyAgreementsQueryKey() });
          }}
        />
      )}
    </Card>
  );
}

function VendorDashboard({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useGetVendor(vendorId);
  const { data: stats, isLoading: statsLoading } = useGetVendorStats();
  const { data: hiringStats, isLoading: hiringLoading } = useGetVendorHiringStats(vendorId);
  const { data: requirements, isLoading: reqsLoading } = useListRequirements({ vendorId });
  const { data: savedTrainers, isLoading: savedLoading } = useListSavedTrainers(vendorId, {
    query: { queryKey: getListSavedTrainersQueryKey(vendorId) },
  });
  const { data: givenEndorsements, isLoading: endorsementsLoading } = useListVendorEndorsements(vendorId, {
    query: { queryKey: getListVendorEndorsementsQueryKey(vendorId) },
  });
  const unsaveTrainer = useUnsaveTrainer();
  const updateEndorsement = useUpdateTrainerEndorsement();
  const deleteEndorsement = useDeleteTrainerEndorsement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingEndorsement, setEditingEndorsement] = useState<{ id: string; trainerId: string; text: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingEndorsementId, setDeletingEndorsementId] = useState<string | null>(null);

  const handleSaveEditEndorsement = () => {
    if (!editingEndorsement) return;
    updateEndorsement.mutate(
      { id: editingEndorsement.trainerId, endorsementId: editingEndorsement.id, data: { text: editText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVendorEndorsementsQueryKey(vendorId) });
          setEditingEndorsement(null);
          toast({ title: "Endorsement updated" });
        },
        onError: () => toast({ title: "Error", description: "Could not update endorsement.", variant: "destructive" }),
      },
    );
  };

  const handleDeleteEndorsement = (endorsementId: string, trainerId: string) => {
    deleteEndorsement.mutate(
      { id: trainerId, endorsementId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVendorEndorsementsQueryKey(vendorId) });
          setDeletingEndorsementId(null);
          toast({ title: "Endorsement removed" });
        },
        onError: () => toast({ title: "Error", description: "Could not remove endorsement.", variant: "destructive" }),
      },
    );
  };

  const handleUnsave = (trainerId: string, trainerName: string) => {
    unsaveTrainer.mutate(
      { id: vendorId, trainerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSavedTrainersQueryKey(vendorId) });
          toast({ title: `Removed ${trainerName} from saved trainers` });
        },
        onError: () => toast({ title: "Error", description: "Could not remove bookmark.", variant: "destructive" }),
      },
    );
  };

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Requirements" value={stats?.totalRequirements || 0} icon={<FileText />} href="#your-requirements" />
        <StatCard title="Open Requirements" value={stats?.openRequirements || 0} icon={<Briefcase />} href="#your-requirements" />
        <StatCard title="Applications" value={stats?.applicationsReceived || 0} icon={<Users />} href="#your-requirements" />
        <StatCard title="Shortlisted" value={stats?.shortlistedTrainers || 0} icon={<Star />} href="#your-requirements" />
        <StatCard title="Hired" value={stats?.hiredTrainers || 0} icon={<CheckCircle />} href="#your-requirements" />
      </div>

      {vendor?.verified && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 w-fit">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-sm leading-tight">Verified by Trainers Hive</p>
            <p className="text-xs text-blue-600 leading-tight mt-0.5">Your company profile has been verified.</p>
          </div>
        </div>
      )}

      {/* Time-to-hire stat card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Avg. Time to Hire</CardTitle>
        </CardHeader>
        <CardContent>
          {hiringLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : !hiringStats || hiringStats.hiredCount === 0 ? (
            <div className="text-muted-foreground text-sm py-1">
              <p className="text-lg font-semibold text-foreground mb-0.5">No hires yet</p>
              <p>Time-to-hire will appear here once you mark an applicant as hired.</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-primary">
                {hiringStats.avgDays} <span className="text-base font-normal text-muted-foreground">days avg.</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hiringStats.hiredCount} {hiringStats.hiredCount === 1 ? "requirement" : "requirements"} hired
                {hiringStats.minDays !== null && hiringStats.maxDays !== null && (
                  <> · fastest {hiringStats.minDays}d · slowest {hiringStats.maxDays}d</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorSpendSection />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Applications Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.applicationsTrend && stats.applicationsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.applicationsTrend}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM d')} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.skillBreakdown && stats.skillBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.skillBreakdown} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="skill" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="your-requirements">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Requirements</CardTitle>
          <Link href="/requirements/new">
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Post New</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {reqsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : requirements && requirements.length > 0 ? (
            <div className="space-y-4">
              {requirements.map(req => (
                <Link key={req.id} href={`/requirements/${req.id}`} className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card hover:shadow-sm">
                  <div>
                    <h4 className="font-semibold">{req.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{req.skill}</Badge>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Due {format(new Date(req.deadline), 'MMM d')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{req.applicationCount} apps</p>
                      <Badge variant={req.status === 'open' ? 'default' : 'secondary'} className="mt-1 capitalize text-[10px] py-0">{req.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-medium text-lg">No requirements yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Post your first training requirement to find expert trainers.</p>
              <Link href="/requirements/new">
                <Button>Post Requirement</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Trainers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" /> Saved Trainers
            </CardTitle>
            <CardDescription>Trainers you've bookmarked for future engagements</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {savedTrainers?.length ?? 0} saved
          </Badge>
        </CardHeader>
        <CardContent>
          {savedLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !savedTrainers?.length ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No saved trainers yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Browse trainers and click "Save Trainer" to keep track of them here.</p>
              <Link href="/trainers"><Button variant="outline" size="sm">Browse Trainers</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {savedTrainers.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border gap-4 hover:border-primary/30 transition-colors">
                  <Link href={`/trainers/${s.trainer.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={s.trainer.avatarUrl}
                      alt={s.trainer.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.trainer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.trainer.mainSkill}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{s.trainer.rating.toFixed(1)}</span>
                        <span className="ml-2">{s.trainer.location}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/trainers/${s.trainer.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">View</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      disabled={unsaveTrainer.isPending}
                      onClick={() => handleUnsave(s.trainer.id, s.trainer.name)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endorsements Given */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-primary" /> Endorsements Given
            </CardTitle>
            <CardDescription>Endorsements you've written for trainers you've worked with</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {givenEndorsements?.length ?? 0} given
          </Badge>
        </CardHeader>
        <CardContent>
          {endorsementsLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !givenEndorsements?.length ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <ThumbsUp className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <p className="font-medium text-muted-foreground">No endorsements yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">After completing a training engagement, you can endorse that trainer from their profile.</p>
              <Link href="/trainers"><Button variant="outline" size="sm">Browse Trainers</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {givenEndorsements.map((e) => (
                <div key={e.id} className="flex items-start justify-between p-3 rounded-lg border gap-4 hover:border-primary/30 transition-colors">
                  <Link href={`/trainers/${e.trainerId}`} className="flex items-start gap-3 min-w-0 flex-1">
                    <img
                      src={e.trainerAvatarUrl}
                      alt={e.trainerName}
                      className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{e.trainerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(e.createdAt), 'MMM yyyy')}</p>
                      <p className="text-sm text-muted-foreground mt-1 italic line-clamp-2">"{e.text}"</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => {
                        setEditingEndorsement({ id: e.id, trainerId: e.trainerId, text: e.text });
                        setEditText(e.text);
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingEndorsementId(e.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit endorsement dialog */}
      <Dialog open={!!editingEndorsement} onOpenChange={(open) => { if (!open) setEditingEndorsement(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Endorsement</DialogTitle>
            <DialogDescription>Update your endorsement for {editingEndorsement ? givenEndorsements?.find((e) => e.id === editingEndorsement.id)?.trainerName : ""}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editText}
              onChange={(ev) => setEditText(ev.target.value)}
              maxLength={300}
              rows={4}
              placeholder="Describe your experience working with this trainer…"
            />
            <p className="text-xs text-muted-foreground text-right">{editText.length}/300</p>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditingEndorsement(null)}>Cancel</Button>
            <Button
              onClick={handleSaveEditEndorsement}
              disabled={updateEndorsement.isPending || editText.trim().length === 0}
            >
              {updateEndorsement.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete endorsement confirmation */}
      <AlertDialog open={!!deletingEndorsementId} onOpenChange={(open) => { if (!open) setDeletingEndorsementId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove endorsement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete your endorsement. The trainer will no longer see it on their profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const end = givenEndorsements?.find((e) => e.id === deletingEndorsementId);
                if (end) handleDeleteEndorsement(end.id, end.trainerId);
              }}
              disabled={deleteEndorsement.isPending}
            >
              {deleteEndorsement.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TrainerDashboard({ trainerId }: { trainerId: string }) {
  const { data: user } = useGetCurrentUser();
  const { data: stats, isLoading: statsLoading } = useGetTrainerStats();
  const { data: applications, isLoading: appsLoading } = useListMyApplications();
  const { data: trainerProfile, isLoading: profileLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });
  const { data: matchingReqs, isLoading: matchLoading } = useListRequirements(
    { status: "open" },
    { query: { queryKey: [...getListRequirementsQueryKey({ status: "open" }), "trainer", trainerId] } },
  );
  const top5 = matchingReqs?.slice(0, 5) ?? [];
  const hasNoSkills = !!trainerProfile && !trainerProfile.mainSkill;
  const [messageAppId, setMessageAppId] = useState<string | null>(null);
  const [messageAppTitle, setMessageAppTitle] = useState<string>("");
  const [withdrawAppId, setWithdrawAppId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState<string>("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const withdrawMutation = useWithdrawApplication();

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Applications" value={stats?.applicationsSent || 0} icon={<FileText />} href="#your-applications" />
        <StatCard title="Shortlisted" value={stats?.shortlisted || 0} icon={<Star />} href="#your-applications" />
        <StatCard title="Hired" value={stats?.hired || 0} icon={<CheckCircle />} href="#your-applications" />
        <StatCard title="Rating" value={stats?.averageRating?.toFixed(1) || "0.0"} icon={<Star className="text-amber-500 fill-amber-500" />} />
        <StatCard title="Reviews" value={stats?.totalReviews || 0} icon={<Users />} />
        <StatCard title="Profile Views" value={stats?.profileViews || 0} icon={<Eye />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Applications Sent</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats?.applicationsTrend && stats.applicationsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.applicationsTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM d')} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none">
          <CardHeader>
            <CardTitle className="text-primary-foreground">Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-primary-foreground/80">Keep your profile updated and apply to new opportunities to increase your chances of getting hired.</p>
            <Link href="/requirements">
              <Button className="w-full bg-white text-primary hover:bg-white/90">Browse Opportunities</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full border-primary-foreground/20 bg-transparent hover:bg-primary-foreground/10 text-primary-foreground">Update Profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Matching Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Matching Requirements
          </CardTitle>
          <CardDescription>Open requirements that match your skills, ranked by relevance</CardDescription>
        </CardHeader>
        <CardContent>
          {matchLoading || profileLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : top5.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              {hasNoSkills ? (
                <>
                  <p className="font-medium text-muted-foreground">No skills set yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Add your primary skill to your profile so we can surface the most relevant requirements for you.
                  </p>
                  <Link href="/profile"><Button variant="outline" size="sm">Complete your profile</Button></Link>
                </>
              ) : (
                <>
                  <p className="font-medium text-muted-foreground">No matching requirements right now</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Check back soon — new requirements are posted regularly. You can also browse all open requirements.
                  </p>
                  <Link href="/requirements"><Button variant="outline" size="sm">Browse all requirements</Button></Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {top5.map((req) => (
                <Link
                  key={req.id}
                  href={`/requirements/${req.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all bg-card gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{req.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{req.vendorName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-normal">
                      {req.skill}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      {format(new Date(req.deadline), "MMM d")}
                    </span>
                    <span className="text-xs font-medium text-primary whitespace-nowrap">
                      Apply →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills in Demand */}
      <SkillsInDemandCard mainSkill={trainerProfile?.mainSkill} />

      <Card id="your-applications">
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : applications && applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map(app => {
                const canMessage = app.status === 'shortlisted' || app.status === 'hired';
                const canWithdraw = app.status !== 'rejected' && app.status !== 'withdrawn';
                const isWithdrawn = app.status === 'withdrawn';
                return (
                  <div
                    key={app.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-colors bg-card gap-4 cursor-pointer ${isWithdrawn ? 'opacity-60 hover:border-border' : 'hover:border-primary/50 hover:shadow-sm'}`}
                    onClick={() => navigate(`/requirements/${app.requirementId}`)}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 rounded-md border">
                        <AvatarImage src={app.requirement.vendorLogoUrl} />
                        <AvatarFallback className="rounded-md">V</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{app.requirement.title}</h4>
                        <p className="text-sm text-muted-foreground">{app.requirement.vendorName}</p>
                        {isWithdrawn && (app as any).withdrawnReason && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{(app as any).withdrawnReason}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                      {app.proposedRate != null && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Proposed: </span>
                          <span className="font-medium">₹{app.proposedRate}</span>
                        </div>
                      )}
                      <Badge
                        variant={
                          app.status === 'hired' ? 'default'
                          : app.status === 'shortlisted' ? 'secondary'
                          : app.status === 'rejected' || app.status === 'withdrawn' ? 'destructive'
                          : 'outline'
                        }
                        className="capitalize w-24 justify-center"
                      >
                        {app.status}
                      </Badge>
                      {canMessage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageAppId(app.id);
                            setMessageAppTitle(app.requirement.title);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message
                        </Button>
                      )}
                      {canWithdraw && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWithdrawAppId(app.id);
                            setWithdrawReason("");
                          }}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-medium text-lg">No applications yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Start applying to training requirements to see them here.</p>
              <Link href="/requirements">
                <Button>Browse Requirements</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdraw confirmation dialog */}
      <Dialog open={!!withdrawAppId} onOpenChange={(open) => { if (!open) setWithdrawAppId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>
              This will notify the vendor. If you were already hired, they will be alerted immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="withdraw-reason">Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea
              id="withdraw-reason"
              placeholder="e.g. Schedule conflict, personal reasons…"
              rows={3}
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setWithdrawAppId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={withdrawMutation.isPending}
              onClick={() => {
                if (!withdrawAppId) return;
                withdrawMutation.mutate(
                  { id: withdrawAppId, data: { reason: withdrawReason.trim() || undefined } },
                  {
                    onSuccess: () => {
                      setWithdrawAppId(null);
                      queryClient.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
                    },
                    onError: () => {
                      setWithdrawAppId(null);
                    },
                  }
                );
              }}
            >
              {withdrawMutation.isPending ? "Withdrawing…" : "Yes, withdraw"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {messageAppId && user?.id && (
        <MessageThread
          applicationId={messageAppId}
          currentUserId={user.id}
          open={!!messageAppId}
          onOpenChange={(open) => { if (!open) setMessageAppId(null); }}
          title={`Message — ${messageAppTitle}`}
        />
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:         { label: "New",          className: "bg-blue-100 text-blue-700 border-blue-200" },
  contacted:   { label: "Contacted",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  in_progress: { label: "In Progress",  className: "bg-purple-100 text-purple-700 border-purple-200" },
  resolved:    { label: "Resolved",     className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  closed:      { label: "Closed",       className: "bg-gray-100 text-gray-700 border-gray-200" },
};

const STATUS_NEXT: Record<string, string> = {
  new: "contacted", contacted: "in_progress", in_progress: "resolved", resolved: "closed", closed: "new",
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  deactivatedAt?: string;
};

type ConfirmAction =
  | { type: "deactivate"; user: AdminUser }
  | { type: "reactivate"; user: AdminUser };

function AdminUsersSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const params = {
    q: q || undefined,
    role: (roleFilter !== "all" ? roleFilter : undefined) as "trainer" | "vendor" | "admin" | undefined,
    status: (statusFilter !== "all" ? statusFilter : undefined) as "active" | "deactivated" | undefined,
    page,
    pageSize: 10,
  };

  const { data, isLoading, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });

  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === "deactivate") {
        await deactivate.mutateAsync({ id: confirm.user.id });
        toast({ title: "Account deactivated", description: `${confirm.user.name} can no longer sign in.` });
      } else if (confirm.type === "reactivate") {
        await reactivate.mutateAsync({ id: confirm.user.id });
        toast({ title: "Account reactivated", description: `${confirm.user.name}'s account is now active.` });
      }
      invalidate();
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setConfirm(null);
    }
  };

  const users: AdminUser[] = (data?.users as AdminUser[] | undefined) ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 border-purple-200",
    vendor: "bg-blue-100 text-blue-800 border-blue-200",
    trainer: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> User Management
            </CardTitle>
            <CardDescription>Manage all platform user accounts</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">{total} total</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No users found matching your filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const isDeactivated = !!u.deactivatedAt;
                    return (
                      <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${isDeactivated ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[160px]">{u.name}</div>
                          <div className="text-xs text-muted-foreground md:hidden truncate">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isDeactivated ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                              <UserX className="h-3 w-3" /> Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                              <UserCheck className="h-3 w-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {u.role !== "admin" && (
                              <>
                                {isDeactivated ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-green-700 border-green-200 hover:bg-green-50 gap-1"
                                    onClick={() => setConfirm({ type: "reactivate", user: u })}
                                  >
                                    <UserCheck className="h-3 w-3" /> Reactivate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                                    onClick={() => setConfirm({ type: "deactivate", user: u })}
                                  >
                                    <UserX className="h-3 w-3" /> Deactivate
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>Page {page} of {totalPages} ({total} users)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "deactivate" && "Deactivate account?"}
              {confirm?.type === "reactivate" && "Reactivate account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "deactivate" &&
                `${confirm.user.name} (${confirm.user.email}) will no longer be able to sign in. You can reactivate at any time.`}
              {confirm?.type === "reactivate" &&
                `${confirm.user.name} (${confirm.user.email}) will regain full access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirm?.type === "deactivate" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirm?.type === "deactivate" && "Deactivate"}
              {confirm?.type === "reactivate" && "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AdminVendorsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = { q: q || undefined, page, pageSize: 10 };

  const { data, isLoading, refetch } = useListAdminVendors(params, {
    query: { queryKey: getListAdminVendorsQueryKey(params) },
  });

  const verifyVendor = useVerifyVendor();

  const [vendorNoteTarget, setVendorNoteTarget] = useState<{ id: string; companyName: string } | null>(null);
  const [vendorNoteText, setVendorNoteText] = useState("");
  const [vendorNoteSubmitting, setVendorNoteSubmitting] = useState(false);

  const handleToggleVerify = async (id: string, currentlyVerified: boolean, name: string) => {
    try {
      await verifyVendor.mutateAsync({ id, data: { verified: !currentlyVerified } });
      queryClient.invalidateQueries({ queryKey: getListAdminVendorsQueryKey() });
      toast({
        title: currentlyVerified ? "Verification removed" : "Vendor verified",
        description: currentlyVerified
          ? `${name} has been unverified.`
          : `${name} has been verified and notified by email.`,
      });
    } catch {
      toast({ title: "Error", description: "Could not update verification.", variant: "destructive" });
    }
  };

  const submitVendorNote = async () => {
    if (!vendorNoteTarget) return;
    const message = vendorNoteText.trim();
    if (!message) return;
    setVendorNoteSubmitting(true);
    try {
      const token = localStorage.getItem("th_token");
      const res = await fetch(`/api/admin/vendors/${vendorNoteTarget.id}/request-verification-info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed");
      }
      toast({
        title: "Info request sent",
        description: `${vendorNoteTarget.companyName} has been emailed with your note. They'll stay pending until verified.`,
      });
      setVendorNoteTarget(null);
      setVendorNoteText("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not send the request.",
        variant: "destructive",
      });
    } finally {
      setVendorNoteSubmitting(false);
    }
  };

  const vendors = data?.vendors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Vendor Verification
          </CardTitle>
          <CardDescription>Grant or revoke the verified badge for vendor companies</CardDescription>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">{total} total</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company or email..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : vendors.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No vendors found.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Industry</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 font-medium">Verified</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[180px]">{v.companyName}</div>
                      <div className="text-xs text-muted-foreground truncate">{v.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{v.industry}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{v.location}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{format(new Date(v.createdAt), "MMM d, yyyy")}</span>
                    </td>
                    <td className="px-4 py-3">
                      {v.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {v.verified ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={verifyVendor.isPending}
                            onClick={() => handleToggleVerify(v.id, true, v.companyName)}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Remove
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700/40 dark:hover:bg-amber-900/20"
                              onClick={() => { setVendorNoteTarget({ id: v.id, companyName: v.companyName }); setVendorNoteText(""); }}
                            >
                              Request info
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                              disabled={verifyVendor.isPending}
                              onClick={() => handleToggleVerify(v.id, false, v.companyName)}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Verify
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>Page {page} of {totalPages} ({total} vendors)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!vendorNoteTarget} onOpenChange={(open) => { if (!open) { setVendorNoteTarget(null); setVendorNoteText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more information</DialogTitle>
            <DialogDescription>
              Tell <span className="font-medium">{vendorNoteTarget?.companyName}</span> what's missing or needs to be corrected before you can verify them. They'll get this note by email and stay <span className="font-medium">unverified</span> until you verify them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vendor-note">Your message to the vendor</Label>
            <Textarea
              id="vendor-note"
              rows={5}
              value={vendorNoteText}
              onChange={(e) => setVendorNoteText(e.target.value)}
              placeholder="e.g. Please add a company logo and a working website URL. The contact designation looks incorrect — please update."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setVendorNoteTarget(null); setVendorNoteText(""); }}>Cancel</Button>
            <Button
              disabled={vendorNoteSubmitting || vendorNoteText.trim().length === 0}
              onClick={submitVendorNote}
            >
              Send request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats();
  const { data: requirements, isLoading: reqsLoading } = useListRecentRequirements();
  const { data: recentUsers, isLoading: recentUsersLoading } = useListAdminUsers({ page: 1, pageSize: 5 } as any);
  const { data: inquiries, isLoading: inqLoading } = useListHireInquiries();
  const { data: hireThroughUsReqs, isLoading: hireThroughUsLoading } = useListHireThroughUsRequirements();
  const { data: flaggedReqs, isLoading: flaggedLoading } = useListRequirements({ flagged: true } as any);
  const deleteRequirement = useDeleteRequirement();
  const unflagRequirement = useUnflagRequirement();
  const hideRequirement = useHideRequirement();
  const unhideRequirement = useUnhideRequirement();
  const warnRequirement = useWarnRequirementVendor();
  const [warnTarget, setWarnTarget] = useState<{ id: string; title: string } | null>(null);
  const [warnMessage, setWarnMessage] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [vreqLoading, setVreqLoading] = useState(true);
  const [vreqNoteTarget, setVreqNoteTarget] = useState<{ id: string; trainerName: string; status: "rejected" | "needs_info" } | null>(null);
  const [vreqNoteText, setVreqNoteText] = useState("");
  const [vreqNoteSubmitting, setVreqNoteSubmitting] = useState(false);

  type AnalyticsTrend = { week: string; count: number }[];
  const [analytics, setAnalytics] = useState<{
    trainerSignupsTrend: AnalyticsTrend;
    applicationsTrend: AnalyticsTrend;
    requirementsTrend: AnalyticsTrend;
  } | null>(null);

  const fetchVerificationRequests = async () => {
    setVreqLoading(true);
    try {
      const res = await fetch("/api/verification-requests");
      if (res.ok) setVerificationRequests(await res.json());
    } finally {
      setVreqLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationRequests();
    fetch("/api/admin/analytics")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalytics(data); })
      .catch(() => {});
  }, []);

  const handleVerificationAction = async (id: string, status: "approved" | "rejected" | "needs_info", adminNote?: string) => {
    const res = await fetch(`/api/verification-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote }),
    });
    if (res.ok) {
      const titles = {
        approved: "Trainer verified!",
        rejected: "Request rejected",
        needs_info: "Trainer notified",
      } as const;
      const descriptions = {
        approved: "The trainer now has a verified badge.",
        rejected: "The request has been declined.",
        needs_info: "We've sent the trainer your notes. Status stays pending until they resubmit.",
      } as const;
      toast({ title: titles[status], description: descriptions[status] });
      fetchVerificationRequests();
    } else {
      toast({ title: "Could not update request", description: "Please try again.", variant: "destructive" });
    }
  };

  const submitVreqNote = async () => {
    if (!vreqNoteTarget || vreqNoteText.trim().length === 0) return;
    setVreqNoteSubmitting(true);
    try {
      await handleVerificationAction(vreqNoteTarget.id, vreqNoteTarget.status, vreqNoteText.trim());
      setVreqNoteTarget(null);
      setVreqNoteText("");
    } finally {
      setVreqNoteSubmitting(false);
    }
  };

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Trainers" value={stats?.trainerCount || 0} icon={<Users />} />
        <StatCard title="Total Vendors" value={stats?.vendorCount || 0} icon={<Building />} />
        <StatCard title="Open Requirements" value={stats?.openRequirementCount || 0} icon={<Briefcase />} />
        <StatCard title="Completed Engagements" value={stats?.completedEngagements || 0} icon={<CheckCircle />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> New Hire Us Inquiries
              </CardTitle>
              <CardDescription>Companies awaiting your response — act on them now</CardDescription>
            </div>
            <Badge variant="default" className="text-xs">
              {inqLoading ? "…" : `${inquiries?.filter(i => i.status === "new").length ?? 0} new`}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {inqLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !inquiries?.filter(i => i.status === "new").length ? (
              <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">All caught up — no new inquiries waiting.</p>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => document.getElementById("hire-inquiries")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  View all inquiries →
                </button>
              </div>
            ) : (
              inquiries
                .filter(i => i.status === "new")
                .slice(0, 5)
                .map((inq) => (
                  <div key={inq.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{inq.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inq.contactName} · {inq.email}
                          {inq.headcount && ` · ${inq.headcount} ppl`}
                        </p>
                        <p className="text-xs mt-1 line-clamp-2 text-foreground/80">{inq.trainingNeed}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {formatDistanceToNow(new Date(inq.createdAt), { addSuffix: true })}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <Button size="sm" className="h-7 px-3 gap-1 text-xs" asChild>
                        <Link href={`/inquiries/${inq.id}`}>
                          Open enquiry →
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" asChild>
                        <a href={`mailto:${inq.email}?subject=Re: Your training inquiry with Trainers Hive`}>
                          <Mail className="h-3 w-3" /> Email
                        </a>
                      </Button>
                      {inq.phone && (
                        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" asChild>
                          <a href={`tel:${inq.phone}`}>
                            <Phone className="h-3 w-3" /> Call
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
            )}
            {!inqLoading && (inquiries?.filter(i => i.status === "new").length ?? 0) > 5 && (
              <button
                className="w-full text-xs text-primary hover:underline pt-1"
                onClick={() => document.getElementById("hire-inquiries")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                View all {inquiries?.filter(i => i.status === "new").length} new inquiries →
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Action Items
            </CardTitle>
            <CardDescription>Things that need your attention right now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
                label: "Pending verifications",
                count: vreqLoading ? null : verificationRequests.filter(r => r.status === "pending").length,
                target: "verification-requests",
              },
              {
                icon: <Flag className="h-4 w-4 text-destructive" />,
                label: "Flagged requirements",
                count: flaggedLoading ? null : (flaggedReqs?.length ?? 0),
                target: "flagged-requirements",
              },
              {
                icon: <Briefcase className="h-4 w-4 text-amber-500" />,
                label: "Hire enquiries",
                count: (inqLoading || hireThroughUsLoading) ? null : ((inquiries?.filter(i => i.status === "new").length ?? 0) + (hireThroughUsReqs?.length ?? 0)),
                target: "hire-inquiries",
              },
            ].map(item => (
              <button
                key={item.label}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border hover:border-primary/40 hover:bg-muted/40 transition-all text-left group"
                onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.count === null ? (
                  <Skeleton className="h-5 w-6 rounded-full" />
                ) : (
                  <Badge variant={item.count > 0 ? "default" : "secondary"} className="text-xs min-w-[1.5rem] justify-center">
                    {item.count}
                  </Badge>
                )}
              </button>
            ))}
            {!vreqLoading && !flaggedLoading && !inqLoading && !hireThroughUsLoading &&
              verificationRequests.filter(r => r.status === "pending").length === 0 &&
              !flaggedReqs?.length &&
              !inquiries?.filter(i => i.status === "new").length &&
              !hireThroughUsReqs?.length && (
              <p className="text-center text-xs text-muted-foreground pt-3 pb-1 flex items-center justify-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" /> All clear — nothing urgent right now
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Requirements</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = "/api/admin/export/requirements";
              }}
              data-testid="button-export-requirements-csv"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {reqsLoading ? <Skeleton className="h-[200px] w-full" /> : requirements?.length ? (
              <div className="space-y-4">
                {requirements.slice(0, 5).map(req => (
                  <Link key={req.id} href={`/requirements/${req.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{req.title}</p>
                      <p className="text-xs text-muted-foreground">{req.vendorName}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                  </Link>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm">No requirements found</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Recent Sign-ups
              </CardTitle>
              <CardDescription>Newest people on the platform</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => document.getElementById("user-management")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent>
            {recentUsersLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (recentUsers as any)?.users?.length ? (
              <div className="space-y-3">
                {((recentUsers as any).users as any[]).slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{u.name || u.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email} · joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">
                      {u.role}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No users yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Trainer Sign-ups
              </CardTitle>
              <CardDescription>Weekly new trainer registrations (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trainerSignupsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Applications
              </CardTitle>
              <CardDescription>Weekly applications received (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.applicationsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(180 60% 35%)" fill="hsl(180 60% 35% / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-primary" /> Requirements Posted
              </CardTitle>
              <CardDescription>Weekly new requirements (12 weeks)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.requirementsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelFormatter={(v) => `Week of ${v}`} />
                  <Area type="monotone" dataKey="count" stroke="hsl(142 60% 35%)" fill="hsl(142 60% 35% / 0.15)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hire Enquiries (combined: Hire Us inquiries + Hire Through Us requirements) */}
      <Card id="hire-inquiries">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Hire Enquiries
            </CardTitle>
            <CardDescription>All managed-sourcing requests — from the Hire Us form and from requirements flagged "Hire Through Us"</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{(inquiries?.length ?? 0) + (hireThroughUsReqs?.length ?? 0)} total</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = "/api/admin/export/applications";
              }}
              data-testid="button-export-applications-csv"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hire-us" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="hire-us" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Hire Us form
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{inquiries?.length ?? 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="hire-through-us" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Hire Through Us
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{hireThroughUsReqs?.length ?? 0}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hire-us">
          {inqLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !inquiries?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No inquiries yet — share the Hire Us page!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-3 pr-4 font-medium">Company</th>
                    <th className="text-left pb-3 pr-4 font-medium">Contact</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">Requirement</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Budget / Timeline</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inquiries.map((inq) => {
                    const s = STATUS_LABELS[inq.status] ?? STATUS_LABELS.new;
                    return (
                      <tr key={inq.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <Link href={`/inquiries/${inq.id}`} className="font-medium hover:underline">
                            {inq.companyName}
                          </Link>
                          {inq.location && <p className="text-xs text-muted-foreground">{inq.location}</p>}
                        </td>
                        <td className="py-3 pr-4">
                          <p>{inq.contactName}</p>
                          <p className="text-xs text-muted-foreground">{inq.email}</p>
                          {inq.phone && <p className="text-xs text-muted-foreground">{inq.phone}</p>}
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell max-w-[200px]">
                          <p className="truncate text-xs text-muted-foreground">{inq.trainingNeed}</p>
                          {inq.headcount && <p className="text-xs mt-0.5">{inq.headcount} people</p>}
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell text-xs">
                          {inq.budget && <p className="font-medium">{inq.budget}</p>}
                          {inq.timeline && <p className="text-muted-foreground">{inq.timeline}</p>}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                              {s.label}
                            </span>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                              <Link href={`/inquiries/${inq.id}`}>Open →</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </TabsContent>
            <TabsContent value="hire-through-us">
          {hireThroughUsLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !hireThroughUsReqs?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hire-through-us requirements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left pb-3 pr-4 font-medium">Title</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">Organisation</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Skill</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Location</th>
                    <th className="text-left pb-3 font-medium">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(hireThroughUsReqs as any[]).map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <Link href={`/requirements/${req.id}`} className="font-medium hover:underline line-clamp-1">
                          {req.title}
                        </Link>
                        {req.isUrgent && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            Urgent
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground">{req.vendorName}</td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {req.location ?? (req.remote ? "Remote" : "—")}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Flagged Requirements */}
      <Card id="flagged-requirements">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" /> Flagged Requirements
            </CardTitle>
            <CardDescription>Requirements reported by trainers as problematic</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
            {flaggedReqs?.length ?? 0} flagged
          </Badge>
        </CardHeader>
        <CardContent>
          {flaggedLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !flaggedReqs?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No flagged requirements — all clear!</p>
          ) : (
            <div className="space-y-3">
              {(flaggedReqs as any[]).map((req) => (
                <div key={req.id} className="flex items-start justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/requirements/${req.id}`} className="font-medium text-sm hover:underline truncate">
                        {req.title}
                      </Link>
                      <Badge variant="outline" className="text-xs font-normal">{req.skill}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.vendorName}</p>
                    {req.flagReason && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <Flag className="h-3 w-3 shrink-0" />
                        {req.flagReason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {(req as any).hidden && (
                      <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                      disabled={unflagRequirement.isPending}
                      onClick={async () => {
                        try {
                          await unflagRequirement.mutateAsync({ id: req.id });
                          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                          toast({ title: "Flag removed", description: `"${req.title}" has been unflagged.` });
                        } catch {
                          toast({ title: "Error", description: "Could not unflag.", variant: "destructive" });
                        }
                      }}
                    >
                      Unflag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => { setWarnTarget({ id: req.id, title: req.title }); setWarnMessage(""); }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Warn vendor
                    </Button>
                    {(req as any).hidden ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        disabled={unhideRequirement.isPending}
                        onClick={async () => {
                          try {
                            await unhideRequirement.mutateAsync({ id: req.id });
                            queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                            toast({ title: "Requirement restored", description: `"${req.title}" is visible publicly again.` });
                          } catch {
                            toast({ title: "Error", description: "Could not unhide.", variant: "destructive" });
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Unhide
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        disabled={hideRequirement.isPending}
                        onClick={async () => {
                          try {
                            await hideRequirement.mutateAsync({ id: req.id });
                            queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                            toast({ title: "Requirement hidden", description: `"${req.title}" is hidden from public listings.` });
                          } catch {
                            toast({ title: "Error", description: "Could not hide.", variant: "destructive" });
                          }
                        }}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={deleteRequirement.isPending}
                      onClick={async () => {
                        if (!confirm(`Remove "${req.title}"? This cannot be undone.`)) return;
                        try {
                          await deleteRequirement.mutateAsync({ id: req.id });
                          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
                          toast({ title: "Requirement removed", description: `"${req.title}" has been deleted.` });
                        } catch {
                          toast({ title: "Error", description: "Could not remove.", variant: "destructive" });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Management */}
      <div id="user-management">
        <AdminUsersSection />
      </div>

      {/* Vendor Verification */}
      <AdminVendorsSection />

      {/* Verification Requests */}
      <Card id="verification-requests">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Verification Requests
            </CardTitle>
            <CardDescription>Trainers applying for a verified badge</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {verificationRequests.filter(r => r.status === "pending").length} pending
          </Badge>
        </CardHeader>
        <CardContent>
          {vreqLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : !verificationRequests.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">No verification requests yet.</p>
          ) : (
            <div className="space-y-3">
              {verificationRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrainerAvatar name={req.trainer?.name ?? "Trainer"} avatarUrl={req.trainer?.avatarUrl} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{req.trainer?.name ?? req.trainerId}</p>
                        <p className="text-xs text-muted-foreground truncate">{req.trainer?.mainSkill}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {req.status === "pending" || req.status === "needs_info" ? (
                        <>
                          {req.status === "needs_info" && (
                            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                              Awaiting resubmission
                            </Badge>
                          )}
                          <Button size="sm" variant="outline" className="text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleVerificationAction(req.id, "approved")}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                            onClick={() => { setVreqNoteTarget({ id: req.id, trainerName: req.trainer?.name ?? "Trainer", status: "needs_info" }); setVreqNoteText(""); }}
                          >
                            Request changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-700 border-red-200 hover:bg-red-50"
                            onClick={() => { setVreqNoteTarget({ id: req.id, trainerName: req.trainer?.name ?? "Trainer", status: "rejected" }); setVreqNoteText(""); }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Badge variant={req.status === "approved" ? "secondary" : "outline"} className={req.status === "approved" ? "bg-green-100 text-green-800" : "text-red-600 border-red-200"}>
                          {req.status === "approved" ? "Approved" : "Rejected"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t pt-3">
                    {req.aadhaarNumber && (
                      <div><span className="text-muted-foreground">Aadhaar: </span><span className="font-mono">{req.aadhaarNumber}</span></div>
                    )}
                    {req.panNumber && (
                      <div><span className="text-muted-foreground">PAN: </span><span className="font-mono">{req.panNumber}</span></div>
                    )}
                    {req.dateOfBirth && (
                      <div><span className="text-muted-foreground">Date of Birth: </span>{req.dateOfBirth}</div>
                    )}
                    {req.qualification && (
                      <div className="col-span-2"><span className="text-muted-foreground">Qualification: </span>{req.qualification}</div>
                    )}
                    {req.message && (
                      <div className="col-span-2"><span className="text-muted-foreground">Note: </span><span className="italic">"{req.message}"</span></div>
                    )}
                    {!req.aadhaarNumber && !req.panNumber && !req.dateOfBirth && !req.qualification && !req.message && (
                      <div className="col-span-2 text-muted-foreground italic">No verification details provided.</div>
                    )}
                    {req.status === "needs_info" && req.adminNote && (
                      <div className="col-span-2 mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                        <span className="text-amber-800 font-medium">Your last note: </span>
                        <span className="text-amber-900">{req.adminNote}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!vreqNoteTarget} onOpenChange={(open) => { if (!open) { setVreqNoteTarget(null); setVreqNoteText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vreqNoteTarget?.status === "needs_info" ? "Request more information" : "Reject verification request"}
            </DialogTitle>
            <DialogDescription>
              {vreqNoteTarget?.status === "needs_info"
                ? <>Tell <span className="font-medium">{vreqNoteTarget?.trainerName}</span> what's missing or needs to be corrected. They'll see this note and can resubmit. Status stays <span className="font-medium">pending</span> until they do.</>
                : <>Explain why you're rejecting <span className="font-medium">{vreqNoteTarget?.trainerName}</span>'s request. They'll be notified.</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="vreq-note">Your message to the trainer</Label>
            <Textarea
              id="vreq-note"
              rows={5}
              value={vreqNoteText}
              onChange={(e) => setVreqNoteText(e.target.value)}
              placeholder={vreqNoteTarget?.status === "needs_info"
                ? "e.g. Aadhaar number unclear — please re-enter. Add a recent qualification certificate."
                : "e.g. Documents could not be verified."}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setVreqNoteTarget(null); setVreqNoteText(""); }}>Cancel</Button>
            <Button
              disabled={vreqNoteSubmitting || vreqNoteText.trim().length === 0}
              onClick={submitVreqNote}
              className={vreqNoteTarget?.status === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {vreqNoteTarget?.status === "needs_info" ? "Send & keep pending" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!warnTarget} onOpenChange={(open) => { if (!open) setWarnTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warn vendor</DialogTitle>
            <DialogDescription>
              Send the vendor an email about <span className="font-medium">"{warnTarget?.title}"</span>. They'll see your message in their inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="warn-message">Your message</Label>
            <Textarea
              id="warn-message"
              rows={5}
              value={warnMessage}
              onChange={(e) => setWarnMessage(e.target.value)}
              placeholder="Explain what needs to change in this requirement…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setWarnTarget(null)}>Cancel</Button>
            <Button
              disabled={warnRequirement.isPending || warnMessage.trim().length === 0}
              onClick={async () => {
                if (!warnTarget) return;
                try {
                  await warnRequirement.mutateAsync({ id: warnTarget.id, data: { message: warnMessage.trim() } });
                  toast({ title: "Warning sent", description: `Vendor for "${warnTarget.title}" has been emailed.` });
                  setWarnTarget(null);
                } catch {
                  toast({ title: "Error", description: "Could not send warning.", variant: "destructive" });
                }
              }}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Send warning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillsInDemandCard({ mainSkill }: { mainSkill?: string | null }) {
  const { data: skillDemand, isLoading } = useGetSkillsDemand();
  const top10 = skillDemand?.slice(0, 10) ?? [];
  const maxCount = top10.length > 0 ? top10[0]!.count : 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" /> Skills in Demand
          </CardTitle>
          <CardDescription className="mt-0.5">Top skills in open requirements right now</CardDescription>
        </div>
        <Link href="/skills-demand">
          <Button variant="outline" size="sm" className="text-xs shrink-0">View all</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 shrink-0" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-4 w-8 shrink-0" />
              </div>
            ))}
          </div>
        ) : top10.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No open requirements yet.</p>
        ) : (
          <div className="space-y-2.5">
            {top10.map((item) => {
              const isMySkill = !!(mainSkill && item.skill.toLowerCase() === mainSkill.toLowerCase());
              const widthPct = Math.max(4, Math.round((item.count / maxCount) * 100));
              return (
                <div key={item.skill} className="flex items-center gap-3">
                  <div
                    className={`w-32 text-sm truncate shrink-0 font-medium ${isMySkill ? "text-primary" : "text-foreground"}`}
                    title={item.skill}
                  >
                    {item.skill}
                    {isMySkill && (
                      <Badge className="ml-1.5 text-[9px] py-0 px-1 h-4 leading-none align-middle">You</Badge>
                    )}
                  </div>
                  <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded transition-all duration-500 ${isMySkill ? "bg-primary" : "bg-primary/25"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="w-16 text-right shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    <span className={`font-semibold ${isMySkill ? "text-primary" : "text-foreground"}`}>{item.count}</span>{" "}
                    {item.count === 1 ? "req" : "reqs"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon, href }: { title: string; value: string | number; icon: React.ReactNode; href?: string }) {
  const handleClick = () => {
    if (!href) return;
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const inner = (
    <Card className={`h-full ${href ? "hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer" : ""}`}>
      <CardContent className="p-6 h-full">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return inner;
  if (href.startsWith("#")) return <div onClick={handleClick} className="cursor-pointer h-full">{inner}</div>;
  return <Link href={href} className="block h-full">{inner}</Link>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isSignedIn } = useAuth();
  const { data: user, isLoading } = useGetCurrentUser({
    query: { enabled: isSignedIn },
  });

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8"><DashboardSkeleton /></div>;
  }

  if (!user) {
    return <div className="container mx-auto px-4 py-8"><DashboardSkeleton /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 capitalize">Welcome back to your {user.role} workspace.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {user.role === 'vendor' && user.vendorId && <VendorDashboard vendorId={user.vendorId} />}
        {user.role === 'trainer' && user.trainerId && <TrainerDashboard trainerId={user.trainerId} />}
        {user.role === 'admin' && <AdminDashboard />}
      </motion.div>
    </div>
  );
}
