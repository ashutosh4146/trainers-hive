import React, { useRef, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListApplicationMessages,
  useSendApplicationMessage,
  getListApplicationMessagesQueryKey,
} from "@workspace/api-client-react";
import { markRead } from "@/hooks/useUnreadMessages";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MessageThreadProps {
  applicationId: string;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function MessageThread({
  applicationId,
  currentUserId,
  open,
  onOpenChange,
  title = "Message Thread",
}: MessageThreadProps) {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useListApplicationMessages(applicationId, {
    query: {
      enabled: open && !!applicationId,
      queryKey: getListApplicationMessagesQueryKey(applicationId),
      refetchOnWindowFocus: true,
      refetchInterval: open ? 15_000 : false,
    },
  });

  // Mark messages as read whenever the thread is open AND messages load/refresh.
  // This covers: initial open, 15-second poll delivering new messages while reading,
  // and re-opens. markRead() updates localStorage + fires a window event that
  // updates `since` inside useUnreadMessages, which is part of the queryKey —
  // guaranteeing a fresh fetch with the new timestamp.
  useEffect(() => {
    if (!open || !auth?.email) return;
    markRead(auth.email);
  }, [open, auth?.email, messages]);

  const sendMutation = useSendApplicationMessage();

  useEffect(() => {
    if (messages && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const { toast } = useToast();

  const sendMessage = () => {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(
      { id: applicationId, data: { body: trimmed } },
      {
        onSuccess: () => {
          setBody("");
          queryClient.invalidateQueries({
            queryKey: getListApplicationMessagesQueryKey(applicationId),
          });
        },
        onError: () => {
          toast({ title: "Failed to send", description: "Your message could not be sent. Please try again.", variant: "destructive" });
        },
      },
    );
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 max-w-lg max-h-[80vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
              <Skeleton className="h-12 w-1/2" />
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg) => {
              const isMine = msg.senderUserId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <Send className="h-8 w-8 opacity-20" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="px-6 py-4 border-t shrink-0 flex gap-2 items-end"
        >
          <Textarea
            placeholder="Write a message…"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="resize-none flex-1"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!body.trim() || sendMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
