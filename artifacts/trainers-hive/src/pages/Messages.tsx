import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListMessageThreads, useGetCurrentUser, getListMessageThreadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageThread } from "@/components/MessageThread";
import { markRead, useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAuth } from "@/hooks/useAuth";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Tab = "chats" | "applications";

function ChatBubblesIllustration() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="56" height="42" rx="8" fill="hsl(180,50%,92%)" stroke="hsl(180,50%,40%)" strokeWidth="3"/>
      <rect x="8" y="16" width="24" height="3" rx="1.5" fill="hsl(180,50%,50%)"/>
      <rect x="8" y="24" width="18" height="3" rx="1.5" fill="hsl(180,50%,50%)"/>
      <path d="M4 46 L12 56 L12 46Z" fill="hsl(180,50%,40%)"/>
      <rect x="34" y="26" width="58" height="44" rx="8" fill="hsl(200,80%,90%)" stroke="hsl(210,80%,50%)" strokeWidth="3"/>
      <circle cx="51" cy="48" r="3.5" fill="hsl(210,80%,55%)"/>
      <circle cx="63" cy="48" r="3.5" fill="hsl(210,80%,55%)"/>
      <circle cx="75" cy="48" r="3.5" fill="hsl(210,80%,55%)"/>
      <path d="M92 70 L84 80 L84 70Z" fill="hsl(210,80%,50%)"/>
    </svg>
  );
}

function statusLabel(status: string) {
  if (status === "hired") return { label: "Hired", cls: "bg-primary/10 text-primary" };
  if (status === "shortlisted") return { label: "Shortlisted", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: status, cls: "bg-muted text-muted-foreground" };
}

export default function Messages() {
  const { auth } = useAuth();
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const { count: unreadCount } = useUnreadMessages();

  const { data: threads, isLoading } = useListMessageThreads({
    query: {
      queryKey: getListMessageThreadsQueryKey(),
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThreadTitle, setOpenThreadTitle] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("chats");

  const openThread = (applicationId: string, title: string) => {
    setOpenThreadId(applicationId);
    setOpenThreadTitle(title);
    if (auth?.email) {
      markRead(auth.email);
      queryClient.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
    }
  };

  const activeThread = threads?.find((t) => t.applicationId === openThreadId);

  const filtered = useMemo(() => {
    if (!threads) return [];
    let list = threads;
    if (tab === "applications") {
      list = list.filter((t) => t.status === "shortlisted" || t.status === "hired");
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.otherPartyName.toLowerCase().includes(q) ||
        t.requirementTitle.toLowerCase().includes(q),
    );
  }, [threads, search, tab]);

  const isVendor = currentUser?.role === "vendor";
  const browseHref = isVendor ? "/trainers" : "/requirements";
  const browseLabel = isVendor ? "browsing trainers" : "browsing requirements";
  const postHref = "/requirements/new";

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/30 flex flex-col">
      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">

        {/* Header */}
        <div className="bg-[hsl(180,50%,22%)] text-white px-5 pt-6 pb-4 rounded-b-2xl shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold tracking-tight">Messages</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/10 border-transparent text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/30 rounded-full h-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setTab("chats")}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                tab === "chats"
                  ? "border-[hsl(180,50%,25%)] text-[hsl(180,50%,25%)] dark:border-primary dark:text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Chats
              {threads && threads.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">({threads.length})</span>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setTab(tab === "applications" ? "chats" : "applications")}
            className={`text-sm transition-colors ${
              tab === "applications"
                ? "text-[hsl(180,50%,25%)] font-semibold dark:text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active only
          </button>
        </div>

        {/* Thread list / States */}
        <div className="flex-1 px-4 pb-8">
          {isLoading ? (
            <div className="space-y-2 mt-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-card border">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-52" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2 text-muted-foreground">
              <Search className="h-10 w-10 opacity-20" />
              <p className="font-medium text-sm">No conversations match "{search}"</p>
            </div>
          ) : !threads || threads.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <ChatBubblesIllustration />
              <div className="space-y-1.5">
                <p className="text-xl font-bold">Welcome to your messages</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Start connecting with others by{" "}
                  <Link href={browseHref} className="text-primary hover:underline font-medium">
                    {browseLabel}
                  </Link>{" "}
                  or{" "}
                  <Link href={postHref} className="text-primary hover:underline font-medium">
                    posting a requirement
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
              <p className="text-sm">No active conversations in this view.</p>
              <button type="button" onClick={() => setTab("chats")} className="text-sm text-primary hover:underline">
                Show all chats
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              {filtered.map((thread) => {
                const isMine = thread.lastMessageSenderUserId === currentUser?.id;
                const hasMessage = !!thread.lastMessageBody;
                const { label, cls } = statusLabel(thread.status);

                return (
                  <button
                    key={thread.applicationId}
                    type="button"
                    onClick={() => openThread(thread.applicationId, thread.requirementTitle)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border hover:bg-accent/40 transition-colors text-left group"
                  >
                    <TrainerAvatar
                      name={thread.otherPartyName}
                      avatarUrl={thread.otherPartyAvatarUrl}
                      className="h-11 w-11 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">{thread.otherPartyName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cls}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-medium mb-0.5">
                        {thread.requirementTitle}
                      </p>
                      {hasMessage ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {isMine ? <span className="text-foreground/50">You: </span> : null}
                          {thread.lastMessageBody}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic">No messages yet — say hello!</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                      {thread.lastMessageAt && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {openThreadId && currentUser && (
        <MessageThread
          applicationId={openThreadId}
          currentUserId={currentUser.id}
          open={!!openThreadId}
          onOpenChange={(open) => {
            if (!open) setOpenThreadId(null);
            else if (auth?.email) {
              markRead(auth.email);
            }
          }}
          title={openThreadTitle || activeThread?.requirementTitle || "Message Thread"}
        />
      )}
    </div>
  );
}
