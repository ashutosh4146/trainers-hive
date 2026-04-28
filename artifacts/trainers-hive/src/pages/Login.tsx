import React, { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Building2, GraduationCap, Users, Mail, ArrowLeft, RefreshCw } from "lucide-react";
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
  getRoleSessionKey,
  getRoleLabel,
  type UserRole,
} from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { OtpInput } from "@/components/OtpInput";
import { sendOtp, verifyOtp } from "@/lib/otpApi";

const ROLES: { id: UserRole; label: string; icon: React.ReactNode }[] = [
  { id: "trainer",  label: "Trainer",           icon: <Users className="h-5 w-5" /> },
  { id: "vendor",   label: "Vendor",             icon: <Building2 className="h-5 w-5" /> },
  { id: "college",  label: "College / Company",  icon: <GraduationCap className="h-5 w-5" /> },
];

type View = "select" | "otp";

export default function Login() {
  const [view, setView] = useState<View>("select");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signIn, auth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  React.useEffect(() => {
    if (auth?.signedIn) navigate("/dashboard");
  }, [auth]);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSending(true);
    try {
      await sendOtp(email.trim());
      setOtp("");
      setView("otp");
      setResendCooldown(60);
      toast({ title: "Verification code sent", description: `Check ${email} for your 6-digit code.` });
    } catch (err) {
      toast({ title: "Could not send code", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsSending(true);
    try {
      await sendOtp(email.trim());
      setOtp("");
      setResendCooldown(60);
      toast({ title: "New code sent", description: "Check your inbox for a fresh verification code." });
    } catch (err) {
      toast({ title: "Could not resend", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedRole || otp.length < 6) return;
    setIsVerifying(true);
    try {
      await verifyOtp(email.trim(), otp);
    } catch (err) {
      toast({ title: "Verification failed", description: (err as Error).message, variant: "destructive" });
      setIsVerifying(false);
      return;
    }

    switchUser.mutate(
      { data: { role: getRoleSessionKey(selectedRole) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          signIn({ signedIn: true, name: email.split("@")[0]!, email: email.trim(), role: selectedRole });
          toast({ title: "Welcome back!", description: `Signed in as ${getRoleLabel(selectedRole)}.` });
          navigate("/dashboard");
        },
        onError: () => {
          toast({ title: "Sign in failed", description: "Please try again.", variant: "destructive" });
          setIsVerifying(false);
        },
      }
    );
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
            {(["select", "otp"] as View[]).map((step, i) => {
              const idx = ["select", "otp"].indexOf(view);
              const isActive = view === step;
              const isDone = ["select", "otp"].indexOf(step) < idx;
              return (
                <React.Fragment key={step}>
                  {i > 0 && <div className={cn("h-px w-8", isDone ? "bg-primary" : "bg-border")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    isActive ? "bg-primary text-primary-foreground" : isDone ? "text-primary" : "text-muted-foreground"
                  )}>
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">
                      {step === "otp" ? "Verify Email" : "Your Details"}
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
                  <form onSubmit={handleSendOtp} className="space-y-5">
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

                    <Button type="submit" size="lg" className="w-full gap-2" disabled={isSending}>
                      <Mail className="h-4 w-4" />
                      {isSending ? "Sending code..." : "Send Verification Code"}
                    </Button>
                  </form>
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

          {/* Step: OTP */}
          {view === "otp" && selectedRole && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Verify your email</h1>
                <p className="text-muted-foreground">
                  We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>
              <Card className="border-2">
                <CardContent className="p-8 space-y-6">
                  <OtpInput value={otp} onChange={setOtp} disabled={isVerifying} />

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={otp.length < 6 || isVerifying}
                    onClick={handleVerify}
                  >
                    {isVerifying ? "Verifying..." : "Verify & Sign In"}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Didn't receive a code?</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={resendCooldown > 0 || isSending}
                      onClick={handleResend}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
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
