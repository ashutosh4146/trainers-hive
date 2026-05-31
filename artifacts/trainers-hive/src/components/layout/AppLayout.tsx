import React from "react";
import { Navbar } from "./Navbar";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, auth } = useAuth();
  const isVendorOrCollege = isSignedIn && auth?.role === "vendor";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col relative w-full">
        <div
          key={location}
          className="flex-1 flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {children}
        </div>
      </main>
      <footer className="border-t py-10 mt-auto bg-card text-card-foreground">
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
    </div>
  );
}
