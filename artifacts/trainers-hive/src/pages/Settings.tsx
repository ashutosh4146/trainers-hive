import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useGetCurrentUser, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";
import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrainerEmailPrefs {
  endorsements: boolean;
  applicationStatus: boolean;
  newRequirementMatch: boolean;
  messages: boolean;
}

interface VendorEmailPrefs {
  newApplication: boolean;
  trainerWithdrew: boolean;
  messages: boolean;
}

const DEFAULT_TRAINER_PREFS: TrainerEmailPrefs = {
  endorsements: true,
  applicationStatus: true,
  newRequirementMatch: true,
  messages: true,
};

const DEFAULT_VENDOR_PREFS: VendorEmailPrefs = {
  newApplication: true,
  trainerWithdrew: true,
  messages: true,
};

type PreferenceItem = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

function SummaryCard({ title, value, helper, icon }: { title: string; value: React.ReactNode; helper: string; icon: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferenceRow({ item, disabled }: { item: PreferenceItem; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-background p-4">
      <div className="min-w-0">
        <Label htmlFor={item.id} className="font-semibold">{item.title}</Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      </div>
      <Switch id={item.id} checked={item.checked} onCheckedChange={item.onChange} disabled={disabled} />
    </div>
  );
}

function ThemeButton({ value, label, active, icon, onClick }: { value: string; label: string; active: boolean; icon: React.ReactNode; onClick: (value: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/40"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        {active && <CheckCircle2 className="h-4 w-4" />}
      </div>
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{value === "system" ? "Follow your device setting." : `Use ${label.toLowerCase()} mode.`}</p>
    </button>
  );
}

export default function Settings() {
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [trainerEmailPrefs, setTrainerEmailPrefs] = useState<TrainerEmailPrefs>(DEFAULT_TRAINER_PREFS);
  const [vendorEmailPrefs, setVendorEmailPrefs] = useState<VendorEmailPrefs>(DEFAULT_VENDOR_PREFS);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const isTrainer = user?.role === "trainer";
  const isVendor = user?.role === "vendor";
  const trainerId = user?.trainerId;
  const vendorId = user?.vendorId;

  useEffect(() => {
    if (isTrainer && trainerId) {
      setIsLoadingPrefs(true);
      customFetch(`/api/trainers/${trainerId}/email-prefs`)
        .then((data: unknown) => {
          if (data && typeof data === "object") {
            setTrainerEmailPrefs({ ...DEFAULT_TRAINER_PREFS, ...(data as Partial<TrainerEmailPrefs>) });
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingPrefs(false));
    } else if (isVendor && vendorId) {
      setIsLoadingPrefs(true);
      customFetch(`/api/vendors/${vendorId}/email-prefs`)
        .then((data: unknown) => {
          if (data && typeof data === "object") {
            setVendorEmailPrefs({ ...DEFAULT_VENDOR_PREFS, ...(data as Partial<VendorEmailPrefs>) });
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingPrefs(false));
    }
  }, [isTrainer, isVendor, trainerId, vendorId]);

  const handleToggleTrainerPref = async (key: keyof TrainerEmailPrefs, value: boolean) => {
    if (!trainerId) return;
    const prev = trainerEmailPrefs;
    const updated = { ...prev, [key]: value };
    setTrainerEmailPrefs(updated);
    setIsSavingPrefs(true);
    try {
      await customFetch(`/api/trainers/${trainerId}/email-prefs`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setTrainerEmailPrefs(prev);
      toast({ title: "Error", description: "Could not save notification preference.", variant: "destructive" });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleToggleVendorPref = async (key: keyof VendorEmailPrefs, value: boolean) => {
    if (!vendorId) return;
    const prev = vendorEmailPrefs;
    const updated = { ...prev, [key]: value };
    setVendorEmailPrefs(updated);
    setIsSavingPrefs(true);
    try {
      await customFetch(`/api/vendors/${vendorId}/email-prefs`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setVendorEmailPrefs(prev);
      toast({ title: "Error", description: "Could not save notification preference.", variant: "destructive" });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter the same password.", variant: "destructive" });
      return;
    }
    setIsSavingPassword(true);
    try {
      await customFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      toast({ title: "Password saved", description: "You can now sign in with your email and password." });
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const activeNotificationCount = isTrainer
    ? Object.values(trainerEmailPrefs).filter(Boolean).length
    : isVendor
    ? Object.values(vendorEmailPrefs).filter(Boolean).length
    : 0;

  const notificationItems: PreferenceItem[] = isTrainer
    ? [
        { id: "pref-endorsements", title: "Endorsement emails", description: "Get notified when a vendor endorses your profile.", checked: trainerEmailPrefs.endorsements, onChange: (v) => handleToggleTrainerPref("endorsements", v) },
        { id: "pref-appstatus", title: "Application status emails", description: "Get notified when you are shortlisted, hired, or not selected.", checked: trainerEmailPrefs.applicationStatus, onChange: (v) => handleToggleTrainerPref("applicationStatus", v) },
        { id: "pref-newreq", title: "New requirement match emails", description: "Alerts for new requirements that match your skills.", checked: trainerEmailPrefs.newRequirementMatch, onChange: (v) => handleToggleTrainerPref("newRequirementMatch", v) },
        { id: "pref-messages", title: "Message emails", description: "Get notified by email when you receive a new message.", checked: trainerEmailPrefs.messages, onChange: (v) => handleToggleTrainerPref("messages", v) },
      ]
    : isVendor
    ? [
        { id: "pref-newapp", title: "New application emails", description: "Get notified when a trainer applies to one of your requirements.", checked: vendorEmailPrefs.newApplication, onChange: (v) => handleToggleVendorPref("newApplication", v) },
        { id: "pref-withdrew", title: "Trainer withdrawal emails", description: "Get notified when a trainer withdraws their application.", checked: vendorEmailPrefs.trainerWithdrew, onChange: (v) => handleToggleVendorPref("trainerWithdrew", v) },
        { id: "pref-vendor-messages", title: "Message emails", description: "Get notified by email when you receive a new message from a trainer.", checked: vendorEmailPrefs.messages, onChange: (v) => handleToggleVendorPref("messages", v) },
      ]
    : [];

  if (userLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 md:py-12">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Skeleton className="h-[560px] rounded-2xl" />
          <Skeleton className="h-[560px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 md:py-12">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Settings</Badge>
              {user?.role && <Badge variant="outline" className="capitalize">{user.role} account</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Account preferences</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Manage appearance, email notifications, privacy visibility, and password login from one clean place.
            </p>
          </div>
          {user && (
            <div className="rounded-2xl border bg-background/80 p-4 shadow-sm lg:min-w-[240px]">
              <p className="text-xs font-medium text-muted-foreground">Signed in as</p>
              <p className="mt-1 truncate font-semibold">{user.name || "User"}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard title="Theme" value={theme === "system" ? "System" : theme === "light" ? "Light" : "Dark"} helper="Current appearance preference." icon={<Palette className="h-5 w-5" />} />
        <SummaryCard title="Notifications" value={activeNotificationCount} helper="Email channels currently enabled." icon={<Bell className="h-5 w-5" />} />
        <SummaryCard title="Security" value="Password" helper="Email/password login can be set here." icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sun className="h-5 w-5 text-primary" /> Appearance</CardTitle>
                <CardDescription>Customize how Trainers Hive looks on your device.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ThemeButton value="light" label="Light" active={theme === "light"} icon={<Sun className="h-5 w-5" />} onClick={setTheme} />
                  <ThemeButton value="dark" label="Dark" active={theme === "dark"} icon={<Moon className="h-5 w-5" />} onClick={setTheme} />
                  <ThemeButton value="system" label="System" active={theme === "system" || !theme} icon={<Monitor className="h-5 w-5" />} onClick={setTheme} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" /> Email notifications
                  {isSavingPrefs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <CardDescription>Choose the emails that are useful for your role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingPrefs ? (
                  <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
                  </div>
                ) : notificationItems.length > 0 ? (
                  notificationItems.map((item) => <PreferenceRow key={item.id} item={item} disabled={isSavingPrefs} />)
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No role-specific notification settings available.</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Password login</CardTitle>
                <CardDescription>Set or update a password for email/password sign in.</CardDescription>
              </CardHeader>
              <CardContent>
                {(user?.role === "trainer" || user?.role === "vendor") ? (
                  <form onSubmit={handleSetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">New password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((value) => !value)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSavingPassword || !password || !confirmPassword}>
                      {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isSavingPassword ? "Saving…" : "Save password"}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Password login is available for trainer and vendor accounts.</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Privacy</CardTitle>
                <CardDescription>Current visibility rules for your role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="font-semibold">Profile visibility</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isTrainer ? "Vendors can see your profile only after you apply or are part of a hiring flow." : isVendor ? "Trainer-facing company details are shown where relevant to requirements and applicants." : "Visibility depends on account role."}
                      </p>
                    </div>
                    <Badge variant="outline">Policy</Badge>
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="font-semibold">Direct contact</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Messages stay inside Trainers Hive so both sides have context and history.</p>
                    </div>
                    <Badge variant="outline">Protected</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Account</CardTitle>
                <CardDescription>Your current account identity.</CardDescription>
              </CardHeader>
              <CardContent>
                {user && (
                  <div className="rounded-2xl border bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <User className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {user.email}</p>
                        <Badge variant="outline" className="mt-2 capitalize">{user.role} account</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
