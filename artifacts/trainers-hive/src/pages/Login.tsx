import React, { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Building2, GraduationCap, Users, Mail, ArrowLeft } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuth,
  isBusinessEmail,
  roleRequiresBusinessEmail,
  getRoleLabel,
  getRoleSessionKey,
  type UserRole,
} from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { sendEmailSignInLink, savePendingAuth, signInWithGoogle } from "@/lib/firebase";

const ROLES: { id: UserRole; label: string; icon: React.ReactNode }[] = [
  { id: "trainer",  label: "Trainer",          icon: <Users className="h-5 w-5" /> },
  { id: "vendor",   label: "Vendor",            icon: <Building2 className="h-5 w-5" /> },
  { id: "college",  label: "College / Company", icon: <GraduationCap className="h-5 w-5" /> },
];

type View = "select" | "sent";

export default function Login() {
  const [view, setView] = useState<View>("select");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { auth, signIn } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  React.useEffect(() => {
    if (auth?.signedIn) navigate("/dashboard");
  }, [auth]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedRole) errs.role = "Select a role to continue.";
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    } else if (selectedRole && roleRequiresBusinessEmail(selectedRole) && !isBusinessEmail(email)) {
      errs.email = "A business email address is required for this role.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedRole) return;
    setIsSending(true);
    try {
      savePendingAuth({ type: "login", role: selectedRole, email: email.trim() });
      await sendEmailSignInLink(email.trim());
      setView("sent");
    } catch (err) {
      toast({ title: "Could not send link", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!selectedRole) return;
    setIsSending(true);
    try {
      savePendingAuth({ type: "login", role: selectedRole, email: email.trim() });
      await sendEmailSignInLink(email.trim());
      toast({ title: "New link sent", description: "Check your inbox for a fresh sign-in link." });
    } catch (err) {
      toast({ title: "Could not resend", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole) {
      setErrors({ role: "Please select a role before signing in with Google." });
      return;
    }
    setIsGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      switchUser.mutate(
        {
          data: {
            role: getRoleSessionKey(selectedRole),
            name: user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || "",
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            signIn({
              signedIn: true,
              name: user.displayName || user.email?.split("@")[0] || "User",
              email: user.email || "",
              role: selectedRole,
            });
            toast({ title: "Welcome back!", description: `Signed in as ${getRoleLabel(selectedRole)}.` });
            navigate("/dashboard");
          },
          onError: () => {
            toast({ title: "Sign in failed", description: "Please try again.", variant: "destructive" });
            setIsGoogleLoading(false);
          },
        }
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes("popup-closed")) {
        toast({ title: "Google sign-in failed", description: msg, variant: "destructive" });
      }
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      <header className="flex items-center gap-2 px-8 py-5 border-b bg-background/80 backdrop-blur">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl tracking-tight text-primary">Trainers Hive</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            {(["select", "sent"] as View[]).map((step, i) => {
              const steps = ["select", "sent"];
              const idx = steps.indexOf(view);
              const isActive = view === step;
              const isDone = steps.indexOf(step) < idx;
              return (
                <React.Fragment key={step}>
                  {i > 0 && <div className={cn("h-px w-8", isDone ? "bg-primary" : "bg-border")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    isActive ? "bg-primary text-primary-foreground" : isDone ? "text-primary" : "text-muted-foreground"
                  )}>
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">
                      {step === "sent" ? "Check Email" : "Your Details"}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Step: Select role + email */}
          {view === "select" && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground">Sign in to your account</p>
              </div>
              <Card className="border-2">
                <CardContent className="p-6">
                  <form onSubmit={handleSendLink} className="space-y-5">
                    <div className="space-y-2">
                      <Label>Sign in as</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {ROLES.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedRole(r.id)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium transition-all",
                              selectedRole === r.id
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            {r.icon}
                            {r.label}
                          </button>
                        ))}
                      </div>
                      {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                        {selectedRole && roleRequiresBusinessEmail(selectedRole) && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">(business email)</span>
                        )}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>

                    <Button type="submit" size="lg" className="w-full gap-2" disabled={isSending || isGoogleLoading}>
                      <Mail className="h-4 w-4" />
                      {isSending ? "Sending link…" : "Send Sign-In Link"}
                    </Button>
                  </form>

                  {selectedRole === "trainer" && (
                    <>
                      <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="w-full gap-2"
                        disabled={isGoogleLoading || isSending}
                        onClick={handleGoogleSignIn}
                      >
                        <FcGoogle className="h-5 w-5" />
                        {isGoogleLoading ? "Signing in…" : "Continue with Google"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
              <p className="text-center text-sm text-muted-foreground">
                New to Trainers Hive?{" "}
                <button type="button" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium" onClick={() => navigate("/signup")}>
                  Create an account
                </button>
              </p>
            </>
          )}

          {/* Step: Check email */}
          {view === "sent" && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Check your inbox</h1>
                <p className="text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>
              <Card className="border-2">
                <CardContent className="p-8 space-y-5">
                  <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground border space-y-1">
                    <p className="font-medium text-foreground">What to do next:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open the email from Trainers Hive</li>
                      <li>Click the <strong>Sign in</strong> button in the email</li>
                      <li>You'll be signed in automatically</li>
                    </ol>
                  </div>

                  <div className="text-center space-y-2 pt-1">
                    <p className="text-sm text-muted-foreground">Didn't receive it?</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={isSending}
                      onClick={handleResend}
                    >
                      {isSending ? "Sending…" : "Resend link"}
                    </Button>
                  </div>

                  <Button type="button" variant="ghost" size="sm" className="w-full gap-1" onClick={() => setView("select")}>
                    <ArrowLeft className="h-4 w-4" /> Change email
                  </Button>
                </CardContent>
              </Card>
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
