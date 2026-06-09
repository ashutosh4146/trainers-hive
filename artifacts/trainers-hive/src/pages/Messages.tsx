import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useListApplicationMessages,
  useListMessageThreads,
  useGetCurrentUser,
  useSendApplicationMessage,
  getListApplicationMessagesQueryKey,
  getListMessageThreadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { markRead, useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAuth } from "@/hooks/useAuth";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { ApplicationPipeline } from "@/components/ApplicationPipeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Send, MessageSquare, ArrowLeft, Inbox, Briefcase, Sparkles, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "all" | "priority" | "needsReply" | "active";
type QuickReply = { label: string; body: string };

type MessageThread = {
  applicationId: string;
  otherPartyName: string;
  otherPartyAvatarUrl?: string | null;
  requirementTitle: string;
  status: string;
  lastMessageBody?: string | null;
  lastMessageAt?: string | null;
  lastMessageSenderUserId?: string | null;
};

const PRIORITY_STORAGE_KEY = "th_priority_conversations";

function draftKey(applicationId: string) {
  return `th_message_draft_${applicationId}`;
}

function getSavedDraft(applicationId: string) {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(draftKey(applicationId)) ?? "";
}

function readPriorityIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRIORITY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writePriorityIds(ids: string[]) {
  localStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function statusLabel(status: string) {
  if (status === "hired") return { label: "Hired", cls: "bg-primary/10 text-primary" };
  if (status === "shortlisted") return { label: "Shortlisted", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  if (status === "completed") return { label: "Completed", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
  if (status === "rejected") return { label: "Not selected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300" };
  if (status === "applied" || status === "submitted") return { label: "Applied", cls: "bg-muted text-muted-foreground" };
  return { label: status || "Open", cls: "bg-muted text-muted-foreground" };
}

function statusDescription(status: string, role?: string) {
  const isVendor = role === "vendor";
  if (status === "hired") return isVendor ? "Trainer has been selected. Use this thread to finalize kickoff, scope, and agreement details." : "You have been selected. Use this thread to confirm kickoff, scope, and agreement details.";
  if (status === "shortlisted") return isVendor ? "Trainer is shortlisted. Confirm availability, commercials, and final fit before hiring." : "You are shortlisted. Confirm your availability, commercials, and final delivery plan here.";
  if (status === "completed") return "This engagement is marked completed. Keep final notes, payment follow-ups, and closure messages here.";
  if (status === "rejected") return isVendor ? "This application was not selected. You can keep a note here for future reference." : "This application was not selected. You can still review the conversation history here.";
  if (status === "withdrawn") return "This application was withdrawn. The conversation is kept for reference.";
  return isVendor ? "Application is under review. Ask for availability, scope fit, or supporting details." : "Application is awaiting vendor review. Share your availability, approach, or clarifying questions.";
}

function getQuickReplies(status: string, role?: string): QuickReply[] {
  const isVendor = role === "vendor";

  if (isVendor) {
    if (status === "submitted" || status === "applied") {
      return [
        { label: "Ask availability", body: "Thanks for applying. Please confirm your availability for the proposed training dates and preferred delivery mode." },
        { label: "Ask commercial terms", body: "Your profile looks relevant. Please share your commercial expectations, availability, and any prerequisites for this requirement." },
        { label: "Schedule discussion", body: "We would like to discuss the requirement in detail. Please share two suitable time slots for a short call." },
      ];
    }
    if (status === "shortlisted") {
      return [
        { label: "Confirm shortlist", body: "You are shortlisted for this requirement. Please confirm your availability, commercials, and readiness to proceed." },
        { label: "Finalize scope", body: "Before selection, let’s finalize the agenda, delivery mode, duration, commercials, and expected outcomes." },
        { label: "Request documents", body: "Please share your updated profile, relevant past training references, and any supporting material for final review." },
      ];
    }
    if (status === "hired") {
      return [
        { label: "Confirm kickoff", body: "You are selected for this requirement. Let’s confirm kickoff date, agenda, prerequisites, and communication plan." },
        { label: "Agreement next", body: "Let’s proceed with the engagement agreement. Please confirm the final scope, dates, fee, and payment terms." },
        { label: "Training readiness", body: "Please share the final training plan, learner prerequisites, setup requirements, and any pre-work material needed." },
      ];
    }
    return [
      { label: "Ask next steps", body: "Thanks for the update. Please confirm the next steps, expected timeline, and any pending details from your side." },
      { label: "Schedule call", body: "Can we schedule a short call to align on scope, timeline, commercials, and delivery expectations?" },
      { label: "Request details", body: "Please share the pending details so we can move this engagement forward smoothly." },
    ];
  }

  if (status === "submitted" || status === "applied") {
    return [
      { label: "Share availability", body: "Thanks for considering my application. I am available to discuss the requirement and can share my detailed approach if needed." },
      { label: "Ask scope", body: "Could you please share more details about learner profile, expected outcomes, delivery mode, and tentative dates?" },
      { label: "Share approach", body: "Based on the requirement, I can prepare a practical training plan covering agenda, exercises, and expected outcomes." },
    ];
  }
  if (status === "shortlisted") {
    return [
      { label: "Confirm interest", body: "Thank you for shortlisting me. I am interested and available to discuss final scope, schedule, and commercials." },
      { label: "Ask call time", body: "Please share a suitable time for a short discussion so we can finalize expectations and delivery details." },
      { label: "Confirm terms", body: "I can proceed once we confirm the dates, batch profile, training mode, deliverables, and commercials." },
    ];
  }
  if (status === "hired") {
    return [
      { label: "Confirm readiness", body: "Thank you for selecting me. I am ready to proceed and can share the final agenda, prerequisites, and training plan." },
      { label: "Ask agreement", body: "Please share the engagement agreement or final terms so we can confirm scope, dates, commercials, and payment terms." },
      { label: "Setup requirements", body: "For smooth delivery, please confirm platform access, learner count, expected hands-on setup, and any internal guidelines." },
    ];
  }
  return [
    { label: "Follow up", body: "Following up on this conversation. Please let me know the next step when convenient." },
    { label: "Share availability", body: "I am available for a quick discussion. Please share a suitable time slot." },
    { label: "Clarify details", body: "Could you please confirm the scope, timeline, delivery mode, and commercials for this engagement?" },
  ];
}

function EmptyInbox({ isVendor }: { isVendor: boolean }) {
  const browseHref = isVendor ? "/trainers" : "/requirements";
  const browseLabel = isVendor ? "Browse trainers" : "Browse opportunities";

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center px-6">
      <div className="mb-4 rounded-full bg-primary/10 p-4">
        <MessageSquare className="h-9 w-9 text-primary" />
      </div>
      <h2 className="text-xl font-bold">No conversations yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        Conversations appear here once there is an application, shortlist, or hiring discussion.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href={browseHref}>{browseLabel}</Link>
        </Button>
        {isVendor && (
          <Button variant="outline" asChild>
            <Link href="/requirements/new">Post requirement</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ConversationPanel({
  applicationId,
  currentUserId,
  title,
  status,
  otherPartyName,
  otherPartyAvatarUrl,
  onBack,
  onDraftChange,
}: {
  applicationId: string;
  currentUserId: string;
  title: string;
  status: string;
  otherPartyName: string;
  otherPartyAvatarUrl?: string | null;
  onBack: () => void;
  onDraftChange: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  const [body, setBody] = useState(() => getSavedDraft(applicationId));
  const bottomRef = useRef<HTMLDivElement>(null);
  const quickReplies = getQuickReplies(status, auth?.role);
  const statusInfo = statusLabel(status);

  const { data, isLoading } = useListApplicationMessages(applicationId, {
    query: {
      enabled: !!applicationId,
      queryKey: getListApplicationMessagesQueryKey(applicationId),
      refetchOnWindowFocus: true,
      refetchInterval: 10_000,
    },
  });

  const messages = Array.isArray(data) ? data : [];
  const sendMutation = useSendApplicationMessage();

  useEffect(() => {
    setBody(getSavedDraft(applicationId));
  }, [applicationId]);

  useEffect(() => {
    if (body.trim()) localStorage.setItem(draftKey(applicationId), body);
    else localStorage.removeItem(draftKey(applicationId));
    onDraftChange();
  }, [applicationId, body, onDraftChange]);

  useEffect(() => {
    if (auth?.email) markRead(auth.email);
  }, [auth?.email, applicationId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const sendMessage = () => {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;

    sendMutation.mutate(
      { id: applicationId, data: { body: trimmed } },
      {
        onSuccess: () => {
          localStorage.removeItem(draftKey(applicationId));
          setBody("");
          onDraftChange();
          queryClient.invalidateQueries({ queryKey: getListApplicationMessagesQueryKey(applicationId) });
          queryClient.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
        },
        onError: () => {
          toast({ title: "Message not sent", description: "Please try again.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <TrainerAvatar name={otherPartyName} avatarUrl={otherPartyAvatarUrl ?? undefined} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{otherPartyName}</h2>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", statusInfo.cls)}>{statusInfo.label}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
        <ApplicationPipeline status={status} compact className="mt-3" />
        <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {statusDescription(status, auth?.role)}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="mb-3 h-9 w-9 opacity-20" />
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-xs">Start the conversation below.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMine = msg.senderUserId === currentUserId;
              return (
                <div key={msg.id} className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
                  <div className={cn("max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm", isMine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}>
                    {msg.body}
                  </div>
                  <span className="px-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="border-t bg-card/50 px-4 py-3 md:px-5">
        <div className="mb-3 flex items-start gap-2 overflow-x-auto pb-1">
          <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Quick replies
          </span>
          {quickReplies.map((reply) => (
            <button key={reply.label} type="button" title={reply.body} onClick={() => setBody(reply.body)} className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
              {reply.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={2}
            placeholder={`Message ${otherPartyName}…`}
            className="max-h-32 resize-none"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!body.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {body.trim() ? "Draft saved automatically. " : ""}Press Enter to send. Shift + Enter for a new line.
        </p>
      </form>
    </section>
  );
}

export default function Messages() {
  const { auth } = useAuth();
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const [draftRevision, setDraftRevision] = useState(0);
  const [priorityIds, setPriorityIds] = useState<string[]>(() => readPriorityIds());
  useUnreadMessages();

  const { data, isLoading } = useListMessageThreads({
    query: {
      queryKey: getListMessageThreadsQueryKey(),
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });

  const threads = Array.isArray(data) ? (data as MessageThread[]) : [];
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const prioritySet = useMemo(() => new Set(priorityIds), [priorityIds]);
  const needsReplyCount = useMemo(
    () => threads.filter((t) => !!t.lastMessageBody && t.lastMessageSenderUserId !== currentUser?.id).length,
    [threads, currentUser?.id],
  );
  const priorityCount = useMemo(
    () => threads.filter((t) => prioritySet.has(t.applicationId)).length,
    [threads, prioritySet],
  );
  const activeCount = useMemo(
    () => threads.filter((t) => t.status === "shortlisted" || t.status === "hired").length,
    [threads],
  );

  const hasDraft = (applicationId: string) => {
    void draftRevision;
    return getSavedDraft(applicationId).trim().length > 0;
  };

  const togglePriority = (applicationId: string) => {
    setPriorityIds((current) => {
      const next = current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [applicationId, ...current];
      writePriorityIds(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = threads;
    if (tab === "priority") list = list.filter((t) => prioritySet.has(t.applicationId));
    if (tab === "needsReply") list = list.filter((t) => !!t.lastMessageBody && t.lastMessageSenderUserId !== currentUser?.id);
    if (tab === "active") list = list.filter((t) => t.status === "shortlisted" || t.status === "hired");

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.otherPartyName.toLowerCase().includes(q) ||
        t.requirementTitle.toLowerCase().includes(q) ||
        (t.lastMessageBody ?? "").toLowerCase().includes(q),
    );
  }, [threads, search, tab, currentUser?.id, prioritySet]);

  const activeThread = activeApplicationId
    ? threads.find((t) => t.applicationId === activeApplicationId)
    : null;
  const isVendor = currentUser?.role === "vendor" || auth?.role === "vendor";

  const openThread = (applicationId: string) => {
    setActiveApplicationId(applicationId);
    if (auth?.email) markRead(auth.email);
    queryClient.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
  };

  const tabButtonClass = (value: Tab) => cn(
    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
    tab === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/30">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl flex-col px-0 md:px-4 md:py-6">
        <div className="flex min-h-[calc(100vh-64px)] overflow-hidden border bg-background shadow-sm md:min-h-[calc(100vh-112px)] md:rounded-2xl">
          <aside className={cn("flex w-full flex-col border-r bg-card md:w-[400px] md:max-w-[400px]", activeThread ? "hidden md:flex" : "flex")}>
            <div className="border-b px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">Messages</h1>
                  <p className="text-xs text-muted-foreground">All conversations in one inbox</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Inbox className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-background px-2 py-2">
                  <p className="text-base font-semibold leading-none">{threads.length}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border bg-background px-2 py-2">
                  <p className="text-base font-semibold leading-none">{needsReplyCount}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Need reply</p>
                </div>
                <div className="rounded-lg border bg-background px-2 py-2">
                  <p className="text-base font-semibold leading-none">{activeCount}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Active</p>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="pl-9" />
              </div>
              <div className="mt-3 grid grid-cols-4 rounded-lg border bg-background p-1 text-sm">
                <button type="button" onClick={() => setTab("all")} className={tabButtonClass("all")}>All</button>
                <button type="button" onClick={() => setTab("priority")} className={tabButtonClass("priority")}>Priority{priorityCount > 0 ? ` (${priorityCount})` : ""}</button>
                <button type="button" onClick={() => setTab("needsReply")} className={tabButtonClass("needsReply")}>Reply{needsReplyCount > 0 ? ` (${needsReplyCount})` : ""}</button>
                <button type="button" onClick={() => setTab("active")} className={tabButtonClass("active")}>Active</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                      <Skeleton className="h-11 w-11 rounded-full" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /><Skeleton className="h-3 w-40" /></div>
                    </div>
                  ))}
                </div>
              ) : threads.length === 0 ? (
                <EmptyInbox isVendor={!!isVendor} />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Search className="mb-3 h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium text-foreground">No matching conversations</p>
                  <button type="button" onClick={() => { setSearch(""); setTab("all"); }} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((thread) => {
                    const isMine = thread.lastMessageSenderUserId === currentUser?.id;
                    const hasMessage = !!thread.lastMessageBody;
                    const needsReply = hasMessage && !isMine;
                    const draftExists = hasDraft(thread.applicationId);
                    const isPriority = prioritySet.has(thread.applicationId);
                    const { label, cls } = statusLabel(thread.status);
                    const isActive = activeThread?.applicationId === thread.applicationId;
                    return (
                      <div key={thread.applicationId} className={cn("rounded-xl border bg-background transition-colors hover:bg-accent/50", isActive && "border-primary/40 bg-primary/5", needsReply && "border-primary/30", isPriority && "ring-1 ring-amber-300/60")}>
                        <div className="flex items-start gap-3 p-3">
                          <TrainerAvatar name={thread.otherPartyName} avatarUrl={thread.otherPartyAvatarUrl} className="h-11 w-11 shrink-0" />
                          <button type="button" onClick={() => openThread(thread.applicationId)} className="min-w-0 flex-1 text-left">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold">{thread.otherPartyName}</span>
                              {isPriority && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Priority</span>}
                              {draftExists && <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Draft</span>}
                              {needsReply && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Needs reply</span>}
                              <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", cls)}>{label}</span>
                            </div>
                            <p className="mb-0.5 truncate text-xs font-medium text-muted-foreground">{thread.requirementTitle}</p>
                            {draftExists ? (
                              <p className="truncate text-xs font-medium text-orange-700 dark:text-orange-300">Draft: {getSavedDraft(thread.applicationId)}</p>
                            ) : hasMessage ? (
                              <p className={cn("truncate text-xs", needsReply ? "font-medium text-foreground" : "text-muted-foreground")}>
                                {isMine ? <span className="text-foreground/50">You: </span> : null}{thread.lastMessageBody}
                              </p>
                            ) : (
                              <p className="truncate text-xs italic text-muted-foreground/50">No messages yet — say hello.</p>
                            )}
                          </button>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {thread.lastMessageAt && <span className="whitespace-nowrap text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}</span>}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); togglePriority(thread.applicationId); }}
                              className={cn("rounded-full p-1.5 transition-colors hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30", isPriority ? "text-amber-500" : "text-muted-foreground")}
                              aria-label={isPriority ? "Remove priority" : "Mark priority"}
                              title={isPriority ? "Remove priority" : "Mark priority"}
                            >
                              <Star className={cn("h-4 w-4", isPriority && "fill-current")} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className={cn("min-w-0 flex-1", activeThread ? "flex" : "hidden md:flex")}>
            {activeThread && currentUser ? (
              <ConversationPanel
                applicationId={activeThread.applicationId}
                currentUserId={currentUser.id}
                title={activeThread.requirementTitle}
                status={activeThread.status}
                otherPartyName={activeThread.otherPartyName}
                otherPartyAvatarUrl={activeThread.otherPartyAvatarUrl}
                onBack={() => setActiveApplicationId(null)}
                onDraftChange={() => setDraftRevision((value) => value + 1)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
                <Briefcase className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium text-foreground">Select a conversation</p>
                <p className="mt-1 text-xs">Choose a thread from the inbox to read and reply.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
