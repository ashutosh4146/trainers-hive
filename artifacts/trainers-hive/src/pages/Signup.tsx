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
import { signInWithToken } from "@/lib/firebase";

const ROLES: {
  id: UserRole;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "trainer",
    label: "Trainer",
    subtitle: "I offer training services",
    icon: <Users className="h-7 w-7" />,
    description: "Showcase your expertise and get hired by organisations for workshops, bootcamps, and corporate sessions.",
  },
  {
    id: "vendor",
    label: "Vendor",
    subtitle: "My business needs trainers",
    icon: <Building2 className="h-7 w-7" />,
    description: "Post training requirements and connect with verified trainers for your teams and employees.",
  },
  {
    id: "college",
    label: "College / Company",
    subtitle: "Institution or corporate entity",
    icon: <GraduationCap className="h-7 w-7" />,
    description: "Find specialised trainers for your students, faculty, or employees. Business email required.",
  },
];

type View = "role" | "details" | "otp";

export default function Signup() {
  const [view, setView] = useState<View>("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signIn } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  // Countdown for resend cooldown
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    setView("details");
  };

  const validateDetails = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    } else if (selectedRole && roleRequiresBusinessEmail(selectedRole) && !isBusinessEmail(email)) {
      errs.email = "A business email address is required for this role. Personal addresses like Gmail or Yahoo are not accepted.";
    }
    if (selectedRole && selectedRole !== "trainer" && !orgName.trim()) {
      errs.orgName = "Organisation name is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleDetailsContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !validateDetails()) return;
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
    let customToken: string | null = null;
    try {
      const result = await verifyOtp(email.trim(), otp);
      customToken = result.customToken;
    } catch (err) {
      toast({ title: "Verification failed", description: (err as Error).message, variant: "destructive" });
      setIsVerifying(false);
      return;
    }

    if (customToken) {
      try {
        await signInWithToken(customToken);
      } catch (err) {
        console.warn("Firebase sign-in failed, continuing without Firebase session:", err);
      }
    }

    switchUser.mutate(
      { data: { role: getRoleSessionKey(selectedRole) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          signIn({
            signedIn: true,
            name: name.trim(),
            email: email.trim(),
            role: selectedRole,
            orgName: orgName.trim() || undefined,
          });
          toast({ title: "Account created!", description: `Welcome to Trainers Hive as a ${getRoleLabel(selectedRole)}.` });
          navigate("/dashboard");
        },
        onError: () => {
          toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
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
        <div className="w-full max-w-2xl space-y-6">

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            {(["role", "details", "otp"] as View[]).map((step, i) => {
              const idx = ["role", "details", "otp"].indexOf(view);
              const isActive = view === step;
              const isDone = ["role", "details", "otp"].indexOf(step) < idx;
              return (
                <React.Fragment key={step}>
                  {i > 0 && <div className={cn("h-px w-8", isDone ? "bg-primary" : "bg-border")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    isActive ? "bg-primary text-primary-foreground" : isDone ? "text-primary" : "text-muted-foreground"
                  )}>
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline capitalize">
                      {step === "otp" ? "Verify Email" : step === "details" ? "Your Details" : "Choose Role"}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Step: Role selection */}
          {view === "role" && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Join Trainers Hive</h1>
                <p className="text-muted-foreground">Select your role to get started</p>
              </div>
              <div className="grid gap-4">
                {ROLES.map((r) => (
                  <Card
                    key={r.id}
                    className={cn(
                      "cursor-pointer border-2 transition-all duration-150 hover:shadow-md",
                      selectedRole === r.id ? "border-primary shadow-sm bg-primary/5" : "border-border hover:border-primary/40"
                    )}
                    onClick={() => setSelectedRole(r.id)}
                  >
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className={cn(
                        "mt-0.5 p-2.5 rounded-lg",
                        selectedRole === r.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {r.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base">{r.label}</p>
                          <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                      </div>
                      <div className={cn(
                        "mt-1 h-5 w-5 rounded-full border-2 flex-shrink-0",
                        selectedRole === r.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}>
                        {selectedRole === r.id && (
                          <div className="h-full w-full rounded-full flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button className="w-full" size="lg" disabled={!selectedRole} onClick={handleRoleContinue}>
                Continue
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button type="button" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium" onClick={() => navigate("/login")}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* Step: Details */}
          {view === "details" && selectedRole && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Your details</h1>
                <p className="text-muted-foreground">
                  Signing up as <span className="font-semibold text-foreground">{getRoleLabel(selectedRole)}</span>
                </p>
              </div>
              <Card className="border-2">
                <CardContent className="p-6">
                  <form onSubmit={handleDetailsContinue} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="e.g. Arav Mehta" value={name} onChange={(e) => setName(e.target.value)} />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                        {roleRequiresBusinessEmail(selectedRole) && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">(business email required)</span>
                        )}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={roleRequiresBusinessEmail(selectedRole) ? "you@yourcompany.com" : "you@example.com"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    {selectedRole !== "trainer" && (
                      <div className="space-y-2">
                        <Label htmlFor="orgName">
                          {selectedRole === "college" ? "Institution / Company Name" : "Company Name"}
                        </Label>
                        <Input
                          id="orgName"
                          placeholder={selectedRole === "college" ? "e.g. MIT Bengaluru" : "e.g. Northwind Corp"}
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                        />
                        {errors.orgName && <p className="text-sm text-destructive">{errors.orgName}</p>}
                      </div>
                    )}
                    {roleRequiresBusinessEmail(selectedRole) && (
                      <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground border">
                        Business email only. Personal email domains (Gmail, Yahoo, Outlook, etc.) are not accepted for this role.
                      </div>
                    )}
                    <div className="flex flex-col gap-3 pt-1">
                      <Button type="submit" size="lg" className="w-full gap-2" disabled={isSending}>
                        <Mail className="h-4 w-4" />
                        {isSending ? "Sending code..." : "Send Verification Code"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="w-full gap-1" onClick={() => setView("role")}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
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
                    {isVerifying ? "Verifying..." : "Verify & Create Account"}
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

                  <Button type="button" variant="ghost" size="sm" className="w-full gap-1" onClick={() => setView("details")}>
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
