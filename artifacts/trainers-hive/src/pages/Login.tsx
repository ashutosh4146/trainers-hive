import React, { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Mail, ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuth,
  isBusinessEmail,
  getRoleLabel,
  getRoleSessionKey,
  type UserRole,
} from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { sendEmailSignInLink, savePendingAuth, signInWithGoogle } from "@/lib/firebase";

type View = "select" | "sent" | "forgot";
type LoginMethod = "link" | "password";

type ResolvedProfile = {
  exists: boolean;
  role?: UserRole;
  name?: string;
  email: string;
  orgName?: string;
  orgType?: string;
};

function toUserRole(role: unknown): UserRole | null {
  return role === "trainer" || role === "vendor" || role === "admin" ? role : null;
}

function fallbackRoleFromEmail(email: string): UserRole {
  return isBusinessEmail(email) ? "vendor" : "trainer";
}

async function resolveProfileForLogin(email: string): Promise<ResolvedProfile> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const res = await fetch(`/api/auth/resolve-profile?email=${encodeURIComponent(normalizedEmail)}`);
    if (res.ok) {
      const profile = await res.json().catch(() => null) as Partial<ResolvedProfile> | null;
      const role = toUserRole(profile?.role);

      if (profile?.exists && role) {
        return {
          exists: true,
          role,
          name: profile.name,
          email: profile.email || normalizedEmail,
          orgName: profile.orgName,
          orgType: profile.orgType,
        };
      }

      if (profile?.exists === false) {
        return { exists: false, email: normalizedEmail };
      }
    }
  } catch {
    // The resolve endpoint is not available in older/local preview builds.
    // Fall through to the app's current login rule so existing magic-link login keeps working.
  }

  return {
    exists: true,
    role: fallbackRoleFromEmail(normalizedEmail),
    email: normalizedEmail,
    name: normalizedEmail.split("@")[0] || "User",
  };
}

export default function Login() {
  const [view, setView] = useState<View>("select");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Password-reset flow
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { auth, signIn } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  React.useEffect(() => {
    if (auth?.signedIn) navigate("/dashboard");
  }, [auth, navigate]);

  const validateEmail = (): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail()) return;

    const normalizedEmail = email.trim().toLowerCase();
    setIsSending(true);
    try {
      const profile = await resolveProfileForLogin(normalizedEmail);
      if (!profile.exists || !profile.role) {
        toast({
          title: "Account not found",
          description: "Please create an account first.",
          variant: "destructive",
        });
        return;
      }

      savePendingAuth({
        type: "login",
        role: profile.role,
        email: profile.email,
        name: profile.name,
        orgName: profile.orgName,
        orgType: profile.orgType,
      });
      await sendEmailSignInLink(profile.email);
      setView("sent");
    } catch (err) {
      toast({ title: "Could not send link", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (!validateEmail()) return;

    const normalizedEmail = email.trim().toLowerCase();
    setIsSending(true);
    try {
      const profile = await resolveProfileForLogin(normalizedEmail);
      if (!profile.exists || !profile.role) {
        toast({
          title: "Account not found",
          description: "Please create an account first.",
          variant: "destructive",
        });
        return;
      }

      savePendingAuth({
        type: "login",
        role: profile.role,
        email: profile.email,
        name: profile.name,
        orgName: profile.orgName,
        orgType: profile.orgType,
      });
      await sendEmailSignInLink(profile.email);
      toast({ title: "New link sent", description: "Check your inbox for a fresh sign-in link." });
    } catch (err) {
      toast({ title: "Could not resend", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      const userEmail = firebaseUser.email || "";
      if (!userEmail) {
        throw new Error("Google did not return an email address.");
      }

      const profile = await resolveProfileForLogin(userEmail);
      if (!profile.exists || !profile.role) {
        toast({
          title: "Account not found",
          description: "Please create an account first.",
          variant: "destructive",
        });
        setIsGoogleLoading(false);
        return;
      }

      switchUser.mutate(
        {
          data: {
            role: getRoleSessionKey(profile.role),
            name: profile.name || firebaseUser.displayName || userEmail.split("@")[0] || "User",
            email: profile.email,
            orgName: profile.orgName,
            orgType: profile.orgType,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            signIn({
              signedIn: true,
              name: profile.name || firebaseUser.displayName || userEmail.split("@")[0] || "User",
              email: profile.email,
              role: profile.role!,
              orgName: profile.orgName,
              orgType: profile.orgType,
            });
            toast({ title: "Welcome back!", description: `Signed in as ${getRoleLabel(profile.role!)}.` });
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) errs.password = "Password is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErrors({ password: data.error ?? "Invalid email or password." });
        setIsPasswordLoading(false);
        return;
      }

      const { sessionToken, user } = await res.json() as {
        sessionToken: string;
        user: { name: string; email: string; role: string };
      };

      const detectedRole = toUserRole(user.role);
      if (!detectedRole) {
        setErrors({ password: "Your account role could not be detected. Please contact support." });
        setIsPasswordLoading(false);
        return;
      }

      if (sessionToken) {
        localStorage.setItem("th_session_token", sessionToken);
        setAuthTokenGetter(() => Promise.resolve(sessionToken));
      }

      switchUser.mutate(
        { data: { role: getRoleSessionKey(detectedRole), email: user.email, name: user.name } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
            signIn({
              signedIn: true,
              name: user.name,
              email: user.email,
              role: detectedRole,
            });
            toast({ title: "Welcome back!", description: `Signed in as ${getRoleLabel(detectedRole)}.` });
            navigate("/dashboard");
          },
          onError: () => {
            toast({ title: "Sign in failed", description: "Please try again.", variant: "destructive" });
            setIsPasswordLoading(false);
          },
        }
      );
    } catch (err) {
      toast({ title: "Sign in failed", description: (err as Error).message, variant: "destructive" });
      setIsPasswordLoading(false);
    }
  };

  const openForgotPassword = () => {
    setErrors({});
    setResetStep("request");
    setResetCode("");
    setNewPassword("");
    setView("forgot");
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/password/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not send reset code.");
      }
      setResetStep("confirm");
      toast({
        title: "Check your inbox",
        description: `If an account exists for ${email.trim()}, we've sent a 6-digit reset code.`,
      });
    } catch (err) {
      toast({ title: "Could not send code", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (resetCode.trim().length !== 6) errs.resetCode = "Enter the 6-digit code from your email.";
    if (newPassword.length < 6) errs.newPassword = "Password must be at least 6 characters.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: resetCode.trim(), password: newPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not reset password.");
      }
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      setPassword("");
      setNewPassword("");
      setResetCode("");
      setResetStep("request");
      setLoginMethod("password");
      setView("select");
    } catch (err) {
      toast({ title: "Reset failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsResetting(false);
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

          {view === "select" && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground">Sign in and we'll detect your profile automatically.</p>
              </div>
              <Card className="border-2">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLoginMethod("link")}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                        loginMethod === "link" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Mail className="h-4 w-4" /> Magic Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMethod("password")}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                        loginMethod === "password" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <KeyRound className="h-4 w-4" /> Password
                    </button>
                  </div>

                  {loginMethod === "password" ? (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <input type="email" name="username" autoComplete="username" value={email} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                      </div>
                      <Button type="submit" size="lg" className="w-full gap-2" disabled={isPasswordLoading}>
                        <KeyRound className="h-4 w-4" />
                        {isPasswordLoading ? "Signing in…" : "Sign In with Password"}
                      </Button>
                      <div className="text-center">
                        <button
                          type="button"
                          className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                          onClick={openForgotPassword}
                        >
                          Forgot password?
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleSendLink}>
                      <Button type="submit" size="lg" className="w-full gap-2" disabled={isSending || isGoogleLoading}>
                        <Mail className="h-4 w-4" />
                        {isSending ? "Detecting profile…" : "Send Sign-In Link"}
                      </Button>
                    </form>
                  )}

                  {loginMethod === "link" && (
                    <>
                      <div className="relative">
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
                        {isGoogleLoading ? "Detecting profile…" : "Continue with Google"}
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

          {view === "forgot" && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-4">
                    <KeyRound className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
                <p className="text-muted-foreground">
                  {resetStep === "request"
                    ? "Enter your email and we'll send you a reset code."
                    : "Enter the code we emailed you and choose a new password."}
                </p>
              </div>
              <Card className="border-2">
                <CardContent className="p-6 space-y-5">
                  {resetStep === "request" ? (
                    <form onSubmit={handleSendResetCode} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email Address</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="username"
                        />
                        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                      </div>
                      <Button type="submit" size="lg" className="w-full gap-2" disabled={isResetting}>
                        <Mail className="h-4 w-4" />
                        {isResetting ? "Sending code…" : "Send reset code"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmReset} className="space-y-4">
                      <input type="email" name="username" autoComplete="username" value={email} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Code sent to <span className="font-semibold text-foreground">{email}</span>
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="reset-code">Reset code</Label>
                        <Input
                          id="reset-code"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="tracking-[0.5em] text-center text-lg"
                        />
                        {errors.resetCode && <p className="text-sm text-destructive">{errors.resetCode}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="At least 6 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowNewPassword((v) => !v)}
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
                      </div>
                      <Button type="submit" size="lg" className="w-full gap-2" disabled={isResetting}>
                        <KeyRound className="h-4 w-4" />
                        {isResetting ? "Updating…" : "Reset password"}
                      </Button>
                      <div className="text-center">
                        <button
                          type="button"
                          className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 font-medium disabled:opacity-50"
                          onClick={handleSendResetCode}
                          disabled={isResetting}
                        >
                          Resend code
                        </button>
                      </div>
                    </form>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => { setErrors({}); setView("select"); }}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to sign in
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
