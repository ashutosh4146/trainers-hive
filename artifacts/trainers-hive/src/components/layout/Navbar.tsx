import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  useListMessageThreads,
  getGetCurrentUserQueryKey,
  getListMessageThreadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, LayoutDashboard, Settings, User as UserIcon, LogOut, Plus, Bell, Sun, Moon, MessageSquare, InboxIcon, FileSignature, Users, Building, Briefcase } from "lucide-react";
import { useAuth, getRoleLabel, type UserRole } from "@/hooks/useAuth";
import { signOutFirebase } from "@/lib/firebase";
import { useUnreadMessages, markRead } from "@/hooks/useUnreadMessages";
import { MessageThread } from "@/components/MessageThread";
import { formatDistanceToNow } from "date-fns";

function statusBadge(status: string) {
  if (status === "hired") return "bg-primary/10 text-primary";
  if (status === "shortlisted") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function Navbar() {
  const { auth, signOut, isSignedIn } = useAuth();
  // Only fetch the current user when signed in — prevents 401s for guests
  const { data: user } = useGetCurrentUser({
    query: {
      enabled: isSignedIn,
      queryKey: getGetCurrentUserQueryKey(),
    },
  });
  const { count: unreadCount } = useUnreadMessages();
  const { resolvedTheme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [bellOpen, setBellOpen] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThreadTitle, setOpenThreadTitle] = useState("");

  const isEligibleForMessages =
    isSignedIn && (auth?.role === "trainer" || auth?.role === "vendor");

  const { data: threads, isLoading: threadsLoading } = useListMessageThreads({
    query: {
      queryKey: getListMessageThreadsQueryKey(),
      enabled: isEligibleForMessages && bellOpen,
      refetchInterval: bellOpen ? 30_000 : false,
    },
  });

  const handleBellOpenChange = (open: boolean) => {
    setBellOpen(open);
    if (open && auth?.email) {
      markRead(auth.email);
      queryClient.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
    }
  };

  const handleOpenThread = (applicationId: string, title: string) => {
    setBellOpen(false);
    setOpenThreadId(applicationId);
    setOpenThreadTitle(title);
    if (auth?.email) markRead(auth.email);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("th_session_token");
    signOut();
    queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
    navigate("/");
    try { await signOutFirebase(); } catch { /* ignore */ }
  };

  const displayName = user?.name || auth?.name || "User";
  const displayEmail = user?.email || auth?.email || "";
  const displayRole = user?.role ? getRoleLabel(user.role as UserRole) : (auth ? getRoleLabel(auth.role) : "");

  const recentThreads = threads?.slice(0, 5) ?? [];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
              <Activity className="h-6 w-6" />
              <span>Trainers Hive</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {isSignedIn && auth?.role === "admin" ? (
                <>
                  <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <Users className="h-4 w-4" /> Trainers
                  </Link>
                  <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <Briefcase className="h-4 w-4" /> Requirements
                  </Link>
                  <Link href="/dashboard#vendor-verification" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                    <Building className="h-4 w-4" /> Vendors
                  </Link>
                  <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors">Trainers</Link>
                  <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors">Requirements</Link>
                  {isSignedIn && auth?.role === "vendor" && (
                    <Link href="/hire-us" className="font-semibold text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-full px-3 py-0.5 text-xs bg-primary/5">Hire Us</Link>
                  )}
                  {isSignedIn && (
                    <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  )}
                  {isSignedIn && auth?.role === "vendor" && (
                    <Link href="/requirements/new" className="hidden sm:flex ml-2">
                      <Button size="sm" className="gap-1 shadow-sm h-8">
                        <Plus className="h-4 w-4" /> Post Requirement
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark"
                ? <Sun className="h-5 w-5 text-muted-foreground" />
                : <Moon className="h-5 w-5 text-muted-foreground" />
              }
            </button>

            {isSignedIn && isEligibleForMessages && (
              <>
                {/* Chat icon — navigates to full Messages page */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate("/messages")}
                        className="p-2 rounded-full hover:bg-accent transition-colors"
                        aria-label="Open messages"
                      >
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Messages</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Bell — notification dropdown */}
                <DropdownMenu open={bellOpen} onOpenChange={handleBellOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="relative p-2 rounded-full hover:bg-accent transition-colors"
                      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
                    >
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white leading-none">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <span className="text-sm font-semibold">Notifications</span>
                      {threads && threads.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => navigate("/messages")}
                        >
                          View all
                        </button>
                      )}
                    </div>

                    {/* Thread list */}
                    {threadsLoading ? (
                      <div className="p-3 space-y-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-3 w-44" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentThreads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                        <InboxIcon className="h-8 w-8 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground/70">
                          Conversations with shortlisted or hired trainers will appear here.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-72">
                        <div className="py-1">
                          {recentThreads.map((thread) => (
                            <button
                              key={thread.applicationId}
                              type="button"
                              onClick={() => handleOpenThread(thread.applicationId, thread.requirementTitle)}
                              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                            >
                              <Avatar className="h-9 w-9 shrink-0 border">
                                <AvatarImage src={thread.otherPartyAvatarUrl} />
                                <AvatarFallback className="text-xs bg-muted">
                                  {thread.otherPartyName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="font-medium text-sm truncate leading-tight">{thread.otherPartyName}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${statusBadge(thread.status)}`}>
                                    {thread.status === "hired" ? "Hired" : thread.status === "shortlisted" ? "Shortlisted" : thread.status}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate font-medium">{thread.requirementTitle}</p>
                                {thread.lastMessageBody ? (
                                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{thread.lastMessageBody}</p>
                                ) : (
                                  <p className="text-xs text-muted-foreground/40 italic mt-0.5">No messages yet</p>
                                )}
                              </div>
                              {thread.lastMessageAt && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                  {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    {/* Footer */}
                    {recentThreads.length > 0 && (
                      <div className="border-t px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => { setBellOpen(false); navigate("/messages"); }}
                          className="w-full text-xs text-center text-primary hover:underline font-medium"
                        >
                          Open all messages
                        </button>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* User avatar dropdown */}
            {!isSignedIn ? (
              <div className="flex items-center gap-2 ml-2">
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button>
                <Button size="sm" onClick={() => navigate("/signup")}>Sign Up</Button>
              </div>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <DropdownMenu>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user?.avatarUrl} alt={displayName} />
                            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <DropdownMenuContent className="w-60" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{displayName}</p>
                          <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                          <p className="text-xs font-semibold text-primary mt-1 uppercase tracking-wider">{displayRole}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link href="/profile">
                        <DropdownMenuItem className="cursor-pointer">
                          <UserIcon className="mr-2 h-4 w-4" />
                          <span>Profile</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/dashboard">
                        <DropdownMenuItem className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          <span>Dashboard</span>
                        </DropdownMenuItem>
                      </Link>
                      {auth?.role !== "admin" && (
                        <Link href="/agreements">
                          <DropdownMenuItem className="cursor-pointer">
                            <FileSignature className="mr-2 h-4 w-4" />
                            <span>Agreements</span>
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link href="/settings">
                        <DropdownMenuItem className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <TooltipContent side="bottom" className="font-medium">
                    Hi, {displayName.split(" ")[0]}!
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </header>

      {/* MessageThread dialog — opened from notification dropdown */}
      {openThreadId && user && (
        <MessageThread
          applicationId={openThreadId}
          currentUserId={user.id}
          open={!!openThreadId}
          onOpenChange={(open) => {
            if (!open) setOpenThreadId(null);
          }}
          title={openThreadTitle || "Message Thread"}
        />
      )}
    </>
  );
}
