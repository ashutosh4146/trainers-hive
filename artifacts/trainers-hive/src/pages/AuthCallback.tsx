import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Activity, CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, getRoleLabel, getRoleSessionKey, type UserRole } from "@/hooks/useAuth";
import {
  isEmailLinkCallback,
  completeEmailLinkSignIn,
  loadPendingAuth,
  clearPendingAuth,
  type PendingAuth,
} from "@/lib/firebase";

type Status = "verifying" | "needs-email" | "completing" | "success" | "error";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "trainer", label: "Trainer" },
  { value: "vendor",  label: "Organisation" },
];

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryRole, setRecoveryRole] = useState<UserRole>("trainer");
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  const completeSignIn = (pending: PendingAuth) => {
    switchUser.mutate(
      {
        data: {
          role: getRoleSessionKey(pending.role as UserRole),
          name: pending.name || pending.email.split("@")[0]!,
          email: pending.email,
          orgName: pending.orgName,
          orgType: pending.orgType,
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
            orgType: pending.orgType,
          });
          clearPendingAuth();
          setStatus("success");
          setTimeout(() => navigate("/dashboard"), 1200);
        },
        onError: () => {
          setStatus("error");
          setErrorMsg("Sign-in succeeded but could not set up your session. Please try again.");
        },
      }
    );
  };

  useEffect(() => {
    async function handleCallback() {
      if (!isEmailLinkCallback()) {
        setStatus("error");
        setErrorMsg("This link is invalid or has already been used.");
        return;
      }

      const pending = loadPendingAuth();
      if (!pending) {
        // Link opened in a different browser — ask for email to recover
        setStatus("needs-email");
        return;
      }

      try {
        await completeEmailLinkSignIn(pending.email);
      } catch (err) {
        setStatus("error");
        setErrorMsg((err as Error).message || "Failed to verify the sign-in link. It may have expired.");
        return;
      }

      completeSignIn(pending);
    }

    handleCallback();
  }, []);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = recoveryEmail.trim();
    if (!email) return;
    setStatus("completing");
    try {
      await completeEmailLinkSignIn(email);
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message || "Could not verify email. The link may have expired — please request a new one.");
      return;
    }
    completeSignIn({ type: "login", role: recoveryRole, email });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      <header className="flex items-center gap-2 px-8 py-5 border-b bg-background/80 backdrop-blur">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl tracking-tight text-primary">Trainers Hive</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm w-full">

          {(status === "verifying" || status === "completing") && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <h2 className="text-xl font-semibold">
                {status === "completing" ? "Signing you in…" : "Verifying your email…"}
              </h2>
              <p className="text-muted-foreground text-sm">Just a moment while we sign you in.</p>
            </>
          )}

          {status === "needs-email" && (
            <>
              <Mail className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Confirm your email</h2>
              <p className="text-muted-foreground text-sm">
                The sign-in link was opened in a different browser. Enter the email you used to request the link.
              </p>
              <form onSubmit={handleRecoverySubmit} className="space-y-4 text-left pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="recovery-email">Email address</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="you@example.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sign in as</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRecoveryRole(r.value)}
                        className={`rounded-lg border py-2 px-1 text-xs font-medium transition-colors ${
                          recoveryRole === r.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full">Continue</Button>
              </form>
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
