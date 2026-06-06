import React from "react";
import { Navbar } from "./Navbar";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { MessageSquare, X } from "lucide-react";
import {
  useGetCurrentUser,
  useGetTrainer,
  useGetVendor,
  getGetTrainerQueryKey,
  getGetVendorQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import {
  ProfileCompletion,
  getTrainerCompletionItems,
  getVendorCompletionItems,
} from "@/components/ProfileCompletion";
import { TrainerApplicationTracker } from "@/components/TrainerApplicationTracker";
import { Button } from "@/components/ui/button";

function FloatingMessagesButton() {
  const [location, navigate] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const { count } = useUnreadMessages();

  const canShow =
    isSignedIn &&
    (auth?.role === "trainer" || auth?.role === "vendor") &&
    location !== "/messages";

  if (!canShow) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/messages")}
      aria-label={count > 0 ? `${count} unread messages` : "Open messages"}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border border-primary-border transition-transform hover:scale-105 active:scale-95"
    >
      <MessageSquare className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white leading-none ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

function ProfileCompletionPrompt() {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);
  const { data: user } = useGetCurrentUser({ query: { enabled: isSignedIn } });

  const trainerId = user?.trainerId ?? "";
  const vendorId = user?.vendorId ?? "";

  const { data: trainer } = useGetTrainer(trainerId, {
    query: { enabled: isSignedIn && auth?.role === "trainer" && !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });

  const { data: vendor } = useGetVendor(vendorId, {
    query: { enabled: isSignedIn && auth?.role === "vendor" && !!vendorId, queryKey: getGetVendorQueryKey(vendorId) },
  });

  if (
    dismissed ||
    !isSignedIn ||
    location === "/profile" ||
    location === "/messages" ||
    (auth?.role !== "trainer" && auth?.role !== "vendor")
  ) {
    return null;
  }

  const items = auth?.role === "trainer"
    ? getTrainerCompletionItems(trainer)
    : getVendorCompletionItems(vendor);
  const score = items.length ? Math.round((items.filter((item) => item.done).length / items.length) * 100) : 100;

  if (score >= 100) return null;

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="relative">
        <ProfileCompletion
          title="Complete your profile"
          description="A complete profile improves trust, matching quality, and response rates."
          items={items}
          ctaHref="/profile"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss profile completion prompt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const isVendorOrCollege = isSignedIn && auth?.role === "vendor";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="relative w-full">
        <ProfileCompletionPrompt />
        <TrainerApplicationTracker />
        <div
          key={location}
          className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {children}
        </div>
      </main>
      <footer className="border-t py-10 bg-card text-card-foreground">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Trainers Hive. A trusted B2B training marketplace.
            </p>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link>
              {isVendorOrCollege && (
                <Link href="/hire-us" className="text-muted-foreground hover:text-primary transition-colors">Hire Us</Link>
              )}
              <Link href="/support" className="text-muted-foreground hover:text-primary transition-colors">Support</Link>
              <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms &amp; Conditions</Link>
            </nav>
          </div>
        </div>
      </footer>
      <FloatingMessagesButton />
    </div>
  );
}
