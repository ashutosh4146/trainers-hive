import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListAdminVendors,
  getListAdminVendorsQueryKey,
  useVerifyVendor,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RefreshCw,
  Building,
  ShieldCheck,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 15;

export default function VendorsPage() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = { q: q || undefined, page, pageSize: PAGE_SIZE };
  const { data, isLoading, refetch } = useListAdminVendors(params, {
    query: { queryKey: getListAdminVendorsQueryKey(params) },
  });

  const verifyVendor = useVerifyVendor();

  const [vendorNoteTarget, setVendorNoteTarget] = useState<{ id: string; companyName: string } | null>(null);
  const [vendorNoteText, setVendorNoteText] = useState("");
  const [vendorNoteSubmitting, setVendorNoteSubmitting] = useState(false);

  const vendors = data?.vendors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        description: `${vendorNoteTarget.companyName} has been emailed with your note.`,
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

  const isAdmin = auth?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building className="h-6 w-6 text-primary" />
              Registered Vendors
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isAdmin ? "Manage and verify all vendor companies on the platform" : "Browse verified vendors"}
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Total Vendors</p>
              <p className="text-2xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold text-primary">
                {vendors.filter((v) => v.verified).length}
              </p>
            </CardContent>
          </Card>
          <Card className="hidden sm:block">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-amber-600">
                {vendors.filter((v) => !v.verified).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, email, or industry..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="space-y-4 p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : vendors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Building className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No vendors found.</p>
                {q && (
                  <Button variant="outline" size="sm" onClick={() => { setQ(""); setPage(1); }}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Company</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Industry</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Location</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Joined</th>
                      <th className="text-left px-4 py-3 font-medium">Verified</th>
                      {isAdmin && <th className="text-right px-4 py-3 font-medium">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendors.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[180px]">{v.companyName}</div>
                          <div className="text-xs text-muted-foreground truncate">{v.email}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{v.industry}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">{v.location}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {v.createdAt ? format(new Date(v.createdAt), "MMM d, yyyy") : "—"}
                          </span>
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
                        {isAdmin && (
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
                                  <ShieldCheck className="h-3 w-3" /> Remove
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                    onClick={() => { setVendorNoteTarget({ id: v.id, companyName: v.companyName }); setVendorNoteText(""); }}
                                  >
                                    <Mail className="h-3 w-3" /> Request info
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                    disabled={verifyVendor.isPending}
                                    onClick={() => handleToggleVerify(v.id, false, v.companyName)}
                                  >
                                    <ShieldCheck className="h-3 w-3" /> Verify
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>
                  Page {page} of {totalPages} ({total} vendors)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request info dialog */}
      <Dialog open={!!vendorNoteTarget} onOpenChange={(open) => { if (!open) { setVendorNoteTarget(null); setVendorNoteText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request verification info</DialogTitle>
            <DialogDescription>
              Tell <span className="font-medium">{vendorNoteTarget?.companyName}</span> what information is missing.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={vendorNoteText}
            onChange={(e) => setVendorNoteText(e.target.value)}
            placeholder="e.g. Please add a company logo and a working website URL."
            className="min-h-[100px]"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setVendorNoteTarget(null); setVendorNoteText(""); }}>
              Cancel
            </Button>
            <Button
              disabled={vendorNoteSubmitting || vendorNoteText.trim().length === 0}
              onClick={submitVendorNote}
            >
              Send request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
