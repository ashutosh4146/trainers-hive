import React from "react";
import { Navbar } from "./Navbar";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const isVendorOrCollege = isSignedIn && auth?.role === "vendor";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="relative w-full">
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
