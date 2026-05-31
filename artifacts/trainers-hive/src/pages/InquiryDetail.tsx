import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetHireInquiry,
  useListHireInquiryMessages,
  useSendHireInquiryMessage,
  useUpdateHireInquiryStatus,
  useGetCurrentUser,
  getListHireInquiryMessagesQueryKey,
  getGetHireInquiryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Briefcase, IndianRupee,
  CalendarDays, Users, Send, Shield,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new",         label: "New",          className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "contacted",   label: "Contacted",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "in_progress", label: "In Progress",  className: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "resolved",    label: "Resolved",     className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "closed",      label: "Closed",       className: "bg-gray-100 text-gray-700 border-gray-200" },
];

function statusMeta(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0]!;
}

export default function InquiryDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const { data: inquiry, isLoading: inqLoading, error: inqError } = useGetHireInquiry(id, {
    query: { queryKey: getGetHireInquiryQueryKey(id) },
  });

  const { data: messages, isLoading: msgsLoading } = useListHireInquiryMessages(id, {
    query: {
      queryKey: getListHireInquiryMessagesQueryKey(id),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const sendMutation = useSendHireInquiryMessage();
  const statusMutation = useUpdateHireInquiryStatus();

  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMutation.mutate(
      { id, data: { body: trimmed } },
      {
        onSuccess: () => {
          setDraft("");
          queryClient.invalidateQueries({ queryKey: getListHireInquiryMessagesQueryKey(id) });
        },
        onError: () => toast({ title: "Could not send", variant: "destructive" }),
      },
    );
  }

  function handleStatusChange(value: string) {
    statusMutation.mutate(
      { id, data: { status: value as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetHireInquiryQueryKey(id) });
          toast({ title: "Status updated", description: `Marked as ${statusMeta(value).label}.` });
        },
        onError: () => toast({ title: "Could not update status", variant: "destructive" }),
      },
    );
  }

  if (inqLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (inqError || !inquiry) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl text-center">
        <p className="text-muted-foreground">This inquiry could not be loaded.</p>
        <Link href={isAdmin ? "/dashboard" : "/messages"}>
          <Button variant="link" className="mt-3">← Back</Button>
        </Link>
      </div>
    );
  }

  const status = statusMeta(inquiry.status);
  const backHref = isAdmin ? "/dashboard#hire-inquiries" : "/messages";

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      <div className="mb-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Inquiry details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  {inquiry.companyName}
                </CardTitle>
                <Badge variant="outline" className={status.className}>{status.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(inquiry.createdAt), { addSuffix: true })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium">{inquiry.contactName}</p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${inquiry.email}`} className="hover:underline truncate">{inquiry.email}</a>
                </p>
                {inquiry.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <a href={`tel:${inquiry.phone}`} className="hover:underline">{inquiry.phone}</a>
                  </p>
                )}
                {inquiry.location && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" /> {inquiry.location}
                  </p>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Training need
                  </p>
                  <p className="whitespace-pre-wrap">{inquiry.trainingNeed}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {inquiry.headcount && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Headcount</p>
                      <p className="font-medium">{inquiry.headcount}</p>
                    </div>
                  )}
                  {inquiry.timeline && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Timeline</p>
                      <p className="font-medium">{inquiry.timeline}</p>
                    </div>
                  )}
                  {inquiry.budget && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Budget</p>
                      <p className="font-medium">{inquiry.budget}</p>
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Admin actions
                  </p>
                  <Select
                    value={inquiry.status}
                    onValueChange={handleStatusChange}
                    disabled={statusMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Messages thread */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-[70vh] min-h-[480px]">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                {isAdmin ? `Conversation with ${inquiry.contactName}` : "Conversation with Trainers Hive team"}
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-3/4" />)}
                </div>
              ) : !messages?.length ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
                  <p>No messages yet.</p>
                  <p className="text-xs">
                    {isAdmin
                      ? "Send the first message to start the conversation."
                      : "Our team will reply here. You'll see their messages once they respond."}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderUserId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            <form onSubmit={handleSend} className="border-t p-3 flex gap-2 items-end">
              <Textarea
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                rows={2}
                className="resize-none flex-1 min-h-[44px]"
                disabled={sendMutation.isPending}
              />
              <Button type="submit" size="icon" disabled={sendMutation.isPending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
