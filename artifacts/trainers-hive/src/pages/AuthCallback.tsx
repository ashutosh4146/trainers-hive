import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, getRoleLabel, getRoleSessionKey, type UserRole } from "@/hooks/useAuth";
import {
  isEmailLinkCallback,
  completeEmailLinkSignIn,
  loadPendingAuth,
  clearPendingAuth,
} from "@/lib/firebase";

type Status = "verifying" | "success" | "error";

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  useEffect(() => {
    async function handleCallback() {
      if (!isEmailLinkCallback()) {
        setStatus("error");
        setErrorMsg("This link is invalid or has already been used.");
        return;
      }

      const pending = loadPendingAuth();
      if (!pending) {
        setStatus("error");
        setErrorMsg("Could not find your sign-in session. Please try again from the same browser.");
        return;
      }

      try {
        await completeEmailLinkSignIn(pending.email);
      } catch (err) {
        setStatus("error");
        setErrorMsg((err as Error).message || "Failed to verify the sign-in link. It may have expired.");
        return;
      }

      clearPendingAuth();

      switchUser.mutate(
        {
          data: {
            role: getRoleSessionKey(pending.role as UserRole),
            name: pending.name || pending.email.split("@")[0]!,
            email: pending.email,
            orgName: pending.orgName,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            signIn({
              signedIn: true,
              name: pending.name || pending.email.split("@")[0]!,
              email: pending.email,
              role: pending.role as UserRole,
              orgName: pending.orgName,
            });
            setStatus("success");
            setTimeout(() => navigate("/dashboard"), 1200);
          },
          onError: () => {
            setStatus("error");
            setErrorMsg("Sign-in succeeded but could not set up your session. Please try again.");
          },
        }
      );
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      <header className="flex items-center gap-2 px-8 py-5 border-b bg-background/80 backdrop-blur">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl tracking-tight text-primary">Trainers Hive</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          {status === "verifying" && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <h2 className="text-xl font-semibold">Verifying your email…</h2>
              <p className="text-muted-foreground text-sm">Just a moment while we sign you in.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">You're in!</h2>
              <p className="text-muted-foreground text-sm">Redirecting to your dashboard…</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Sign-in failed</h2>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => navigate("/login")}>Back to Sign In</Button>
                <Button variant="outline" onClick={() => navigate("/signup")}>Create Account</Button>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="text-center text-xs text-muted-foreground py-5 border-t">
        &copy; {new Date().getFullYear()} Trainers Hive. A trusted B2B training marketplace.
      </footer>
    </div>
  );
}
