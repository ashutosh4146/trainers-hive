import React from "react";
import { Navbar } from "./Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col relative w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-1 flex flex-col w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="border-t py-8 mt-auto bg-card text-card-foreground">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Trainers Hive. A trusted B2B training marketplace.</p>
        </div>
      </footer>
    </div>
  );
}
