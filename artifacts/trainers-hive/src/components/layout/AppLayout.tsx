import React from "react";
import { Navbar } from "./Navbar";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { BriefcaseBusiness, CalendarDays, LayoutDashboard, Link2, MessageSquare, Settings, Sparkles, UserRound, X } from "lucide-react";
import {
  useGetCurrentUser,
  useGetTrainer,
  useGetVendor,
  getGetTrainerQueryKey,
  getGetVendorQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { markRead, useUnreadMessages } from "@/hooks/useUnreadMessages";
import {
  ProfileCompletion,
  getTrainerCompletionItems,
  getVendorCompletionItems,
} from "@/components/ProfileCompletion";
import { PaginatedTrainersDirectory } from "@/components/PaginatedTrainersDirectory";
import { ProfileExtrasPanel } from "@/components/ProfileExtrasPanel";
import { RequirementDeadlineDomGuard } from "@/components/RequirementDeadlineDomGuard";
import { TrainerDashboardRedesign } from "@/components/TrainerDashboardRedesign";
import { TrainerProfilePolishPage } from "@/components/TrainerProfilePolishPage";
import { VendorDashboardPolish } from "@/components/VendorDashboardPolish";
import { VendorProfileRequired } from "@/components/VendorProfileRequired";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function FloatingMessagesButton() {
  const [location, navigate] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const { count } = useUnreadMessages();
  const canShow = isSignedIn && (auth?.role === "trainer" || auth?.role === "vendor") && location !== "/messages";
  if (!canShow) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (auth?.email) markRead(auth.email);
        navigate("/messages");
      }}
      aria-label={count > 0 ? `${count} unread messages` : "Open messages"}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border border-primary-border transition-transform hover:scale-105 active:scale-95"
    >
      <MessageSquare className="h-6 w-6" />
      {count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white leading-none ring-2 ring-background">{count > 9 ? "9+" : count}</span>}
    </button>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

function ProfilePageSidebar({ role }: { role: "trainer" | "vendor" }) {
  const items = role === "trainer"
    ? [
        { href: "#profile-overview", label: "Overview", helper: "Strength and summary", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "#profile-contact", label: "Contact", helper: "Name, email, phone, address", icon: <Link2 className="h-4 w-4" /> },
        { href: "#profile-professional", label: "Professional", helper: "Skills, language, bio", icon: <UserRound className="h-4 w-4" /> },
        { href: "#profile-accomplishments", label: "Accomplishments", helper: "Profiles, work, patents", icon: <Sparkles className="h-4 w-4" /> },
        { href: "#profile-experience", label: "Experience", helper: "Employment, education", icon: <BriefcaseBusiness className="h-4 w-4" /> },
        { href: "#profile-availability", label: "Availability", helper: "Engaged dates", icon: <CalendarDays className="h-4 w-4" /> },
      ]
    : [
        { href: "#profile-overview", label: "Overview", helper: "Company strength", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "#profile-company", label: "Company", helper: "Required details", icon: <BriefcaseBusiness className="h-4 w-4" /> },
        { href: "#profile-contact", label: "Contact", helper: "Mobile, address, logo", icon: <Link2 className="h-4 w-4" /> },
        { href: "#profile-accomplishments", label: "Online profiles", helper: "Company links", icon: <Sparkles className="h-4 w-4" /> },
      ];

  return (
    <aside className="hidden xl:block xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
      <div className="rounded-2xl border bg-card/80 p-3 shadow-sm backdrop-blur">
        <div className="mb-3 rounded-xl bg-primary/10 p-3">
          <div className="flex items-center gap-2 font-semibold text-primary"><Settings className="h-4 w-4" /> Profile menu</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">All profile sections are now in one sidebar.</p>
        </div>
        <nav className="space-y-2">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="group flex gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-primary/5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{item.icon}</span>
              <span className="min-w-0"><span className="block text-sm font-semibold group-hover:text-primary">{item.label}</span><span className="block text-xs leading-relaxed text-muted-foreground">{item.helper}</span></span>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ProfileCompletionPrompt() {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);
  const { data: user } = useGetCurrentUser({ query: { enabled: isSignedIn } });
  const trainerId = user?.trainerId ?? "";
  const vendorId = user?.vendorId ?? "";
  const { data: trainer } = useGetTrainer(trainerId, { query: { enabled: isSignedIn && auth?.role === "trainer" && !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) } });
  const { data: vendor } = useGetVendor(vendorId, { query: { enabled: isSignedIn && auth?.role === "vendor" && !!vendorId, queryKey: getGetVendorQueryKey(vendorId) } });

  if (dismissed || !isSignedIn || location === "/dashboard" || location === "/profile" || location === "/messages" || location === "/trainers" || location.startsWith("/trainers/") || (auth?.role !== "trainer" && auth?.role !== "vendor")) return null;
  const items = auth?.role === "trainer" ? getTrainerCompletionItems(trainer) : getVendorCompletionItems(vendor);
  const score = items.length ? Math.round((items.filter((item) => item.done).length / items.length) * 100) : 100;
  if (score >= 100) return null;

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="relative">
        <ProfileCompletion title="Complete your profile" description="A complete profile improves trust, matching quality, and response rates." items={items} ctaHref="/profile" />
        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => setDismissed(true)} aria-label="Dismiss profile completion prompt"><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const { data: currentUser, isLoading: currentUserLoading } = useGetCurrentUser({ query: { enabled: isSignedIn } });
  const isVendorOrCollege = isSignedIn && auth?.role === "vendor";
  const isDashboard = location === "/dashboard";
  const isProfile = location === "/profile";
  const dashboardRole = auth?.role ?? currentUser?.role;
  const useTrainerDashboard = isDashboard && dashboardRole === "trainer";
  const vendorDashboardId = isDashboard && dashboardRole === "vendor" ? (currentUser?.vendorId ?? auth?.vendorId ?? "") : "";
  const vendorProfileId = isProfile && dashboardRole === "vendor" ? (currentUser?.vendorId ?? auth?.vendorId ?? "") : "";
  const trainerProfileId = isProfile && dashboardRole === "trainer" ? (currentUser?.trainerId ?? auth?.trainerId ?? "") : "";
  const useVendorDashboard = !!vendorDashboardId;
  const useVendorProfile = !!vendorProfileId;
  const useTrainerProfile = !!trainerProfileId;
  const waitForDashboardRole = (isDashboard || isProfile) && isSignedIn && currentUserLoading && !dashboardRole;
  const usePaginatedTrainers = location === "/trainers" && dashboardRole === "admin";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <RequirementDeadlineDomGuard />
      <Navbar />
      <main className="relative w-full">
        <ProfileCompletionPrompt />
        <div key={location} className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
          {waitForDashboardRole ? <DashboardLoadingShell /> : useTrainerDashboard ? <TrainerDashboardRedesign /> : useVendorDashboard ? (
            <div className="container mx-auto max-w-7xl px-4 py-8"><VendorDashboardPolish vendorId={vendorDashboardId} /></div>
          ) : useVendorProfile ? (
            <div className="container mx-auto max-w-[1500px] px-4 py-8">
              <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                <ProfilePageSidebar role="vendor" />
                <div className="min-w-0 space-y-6 [&>.container]:max-w-none [&>.container]:px-0 [&>.container]:py-0">
                  <div id="profile-overview" className="scroll-mt-24"><VendorProfileRequired vendorId={vendorProfileId} /></div>
                  <ProfileExtrasPanel role="vendor" id={vendorProfileId} />
                </div>
              </div>
            </div>
          ) : useTrainerProfile ? (
            <div className="container mx-auto max-w-[1500px] px-4 py-8">
              <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                <ProfilePageSidebar role="trainer" />
                <div className="min-w-0 space-y-6 [&>.container]:max-w-none [&>.container]:px-0 [&>.container]:py-0">
                  <div id="profile-overview" className="scroll-mt-24"><TrainerProfilePolishPage trainerId={trainerProfileId} registeredEmail={currentUser?.email ?? ""} /></div>
                  <ProfileExtrasPanel role="trainer" id={trainerProfileId} />
                </div>
              </div>
            </div>
          ) : usePaginatedTrainers ? <PaginatedTrainersDirectory /> : children}
        </div>
      </main>
      <footer className="border-t py-10 bg-card text-card-foreground">
        <div className="container mx-auto px-4 max-w-5xl"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Trainers Hive. A trusted B2B training marketplace.</p><nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link>{isVendorOrCollege && <Link href="/hire-us" className="text-muted-foreground hover:text-primary transition-colors">Hire Us</Link>}<Link href="/support" className="text-muted-foreground hover:text-primary transition-colors">Support</Link><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms &amp; Conditions</Link></nav></div></div>
      </footer>
      <FloatingMessagesButton />
    </div>
  );
}
