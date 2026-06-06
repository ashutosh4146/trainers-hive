import React from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
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
import { Activity, LayoutDashboard, Settings, User as UserIcon, LogOut, Plus, Sun, Moon, FileSignature, Users, Building, Briefcase, Bell, CheckCircle2, BadgeCheck, CreditCard, UserCheck, ClipboardCheck, InboxIcon } from "lucide-react";
import { useAuth, getRoleLabel, type UserRole } from "@/hooks/useAuth";
import { signOutFirebase } from "@/lib/firebase";
import { useNotifications, getNotificationLabel, type AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  const className = "h-4 w-4";
  switch (type) {
    case "trainer_shortlisted":
      return <UserCheck className={className} />;
    case "trainer_hired":
      return <Briefcase className={className} />;
    case "requirement_approved":
    case "requirement_rejected":
      return <ClipboardCheck className={className} />;
    case "agreement_signed":
      return <FileSignature className={className} />;
    case "payment_released":
      return <CreditCard className={className} />;
    case "profile_verification_update":
      return <BadgeCheck className={className} />;
    case "new_application_received":
      return <InboxIcon className={className} />;
    default:
      return <CheckCircle2 className={className} />;
  }
}

export function Navbar() {
  const { auth, signOut, isSignedIn } = useAuth();
  const { data: user } = useGetCurrentUser({
    query: {
      enabled: isSignedIn,
      queryKey: getGetCurrentUserQueryKey(),
    },
  });
  const {
    notifications,
    unreadCount: notificationUnreadCount,
    isLoading: notificationsLoading,
    markRead,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications();
  const { resolvedTheme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const recentNotifications = notifications.slice(0, 5);
  const showNotifications = isSignedIn && auth?.role !== "admin";

  const handleSignOut = async () => {
    localStorage.removeItem("th_session_token");
    signOut();
    queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
    navigate("/");
    try { await signOutFirebase(); } catch { /* ignore */ }
  };

  const openNotification = async (notification: AppNotification) => {
    setNotificationsOpen(false);
    if (!notification.readAt) {
      try { await markRead(notification); } catch { /* best effort */ }
    }
    if (notification.href) navigate(notification.href);
    else navigate("/notifications");
  };

  const openAllNotifications = () => {
    setNotificationsOpen(false);
    navigate("/notifications");
  };

  const displayName = user?.name || auth?.name || "User";
  const displayEmail = user?.email || auth?.email || "";
  const displayRole = user?.role ? getRoleLabel(user.role as UserRole) : (auth ? getRoleLabel(auth.role) : "");

  return (
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
                <Link href="/vendors" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Building className="h-4 w-4" /> Vendors
                </Link>
                <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              </>
            ) : (
              <>
                {isSignedIn && (
                  <>
                    <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors">Trainers</Link>
                    <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors">Requirements</Link>
                  </>
                )}
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

          {showNotifications && (
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative p-2 rounded-full hover:bg-accent transition-colors"
                  aria-label={notificationUnreadCount > 0 ? `${notificationUnreadCount} unread notifications` : "Notifications"}
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {notificationUnreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none">
                      {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0" sideOffset={8}>
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Notifications</p>
                    <p className="truncate text-[11px] text-muted-foreground">System and marketplace updates</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {notificationUnreadCount > 0 && (
                      <button
                        type="button"
                        disabled={isMarkingAllRead}
                        className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                        onClick={() => markAllRead().catch(() => {})}
                      >
                        Mark all read
                      </button>
                    )}
                    <button type="button" className="text-xs text-primary hover:underline" onClick={openAllNotifications}>View all</button>
                  </div>
                </div>

                {notificationsLoading ? (
                  <div className="p-4 space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-3"><div className="h-8 w-8 rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-32 rounded bg-muted" /><div className="h-3 w-48 rounded bg-muted" /></div></div>
                    ))}
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground opacity-30" />
                    <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Updates like shortlists, hiring, approvals, agreements, payments, and applications will appear here.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-80">
                    <div className="py-1">
                      {recentNotifications.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => openNotification(notification)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><NotificationIcon type={notification.type} /></span>
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{notification.title || getNotificationLabel(notification.type)}</span>
                              {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                            </span>
                            {notification.body && <span className="mt-0.5 block max-w-full truncate text-xs text-muted-foreground">{notification.body}</span>}
                            <span className="mt-1 block truncate text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isSignedIn ? (
            <div className="flex items-center gap-2 ml-2"><Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button></div>
          ) : (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <DropdownMenu>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1">
                        <Avatar className="h-9 w-9"><AvatarImage src={user?.avatarUrl} alt={displayName} /><AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <DropdownMenuContent className="w-60" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{displayName}</p><p className="text-xs leading-none text-muted-foreground">{displayEmail}</p><p className="text-xs font-semibold text-primary mt-1 uppercase tracking-wider">{displayRole}</p></div></DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/profile"><DropdownMenuItem className="cursor-pointer"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></DropdownMenuItem></Link>
                    <Link href="/dashboard"><DropdownMenuItem className="cursor-pointer"><LayoutDashboard className="mr-2 h-4 w-4" /><span>Dashboard</span></DropdownMenuItem></Link>
                    {auth?.role !== "admin" && <Link href="/agreements"><DropdownMenuItem className="cursor-pointer"><FileSignature className="mr-2 h-4 w-4" /><span>Agreements</span></DropdownMenuItem></Link>}
                    <Link href="/settings"><DropdownMenuItem className="cursor-pointer"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem></Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /><span>Sign Out</span></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="bottom" className="font-medium">Hi, {displayName.split(" ")[0]}!</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </header>
  );
}
