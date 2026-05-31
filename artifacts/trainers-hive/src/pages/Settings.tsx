import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useGetCurrentUser, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { Bell, Moon, Sun, Lock, User, Monitor, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
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

export default function Settings() {
  const { data: user } = useGetCurrentUser();
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and application settings.</p>
      </div>

      <div className="grid gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" /> Appearance
              </CardTitle>
              <CardDescription>Customize how the platform looks on your device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme Preference</Label>
                  <p className="text-sm text-muted-foreground">Select your preferred color theme.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                  <Button variant={theme === 'light' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('light')} className="h-8 px-3">
                    <Sun className="h-4 w-4 mr-2" /> Light
                  </Button>
                  <Button variant={theme === 'dark' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('dark')} className="h-8 px-3">
                    <Moon className="h-4 w-4 mr-2" /> Dark
                  </Button>
                  <Button variant={theme === 'system' ? 'default' : 'ghost'} size="sm" onClick={() => setTheme('system')} className="h-8 px-3">
                    <Monitor className="h-4 w-4 mr-2" /> System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Email Notifications
                {isSavingPrefs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
              </CardTitle>
              <CardDescription>
                {isTrainer
                  ? "Choose which email notifications you want to receive."
                  : isVendor
                  ? "Choose which email notifications you want to receive."
                  : "Choose what updates you want to receive."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPrefs ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
                </div>
              ) : isTrainer ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-endorsements">Endorsement Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified when a vendor endorses your profile.</p>
                    </div>
                    <Switch
                      id="pref-endorsements"
                      checked={trainerEmailPrefs.endorsements}
                      onCheckedChange={(v) => handleToggleTrainerPref("endorsements", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-appstatus">Application Status Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified when you are shortlisted, hired, or not selected.</p>
                    </div>
                    <Switch
                      id="pref-appstatus"
                      checked={trainerEmailPrefs.applicationStatus}
                      onCheckedChange={(v) => handleToggleTrainerPref("applicationStatus", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-newreq">New Requirement Match Emails</Label>
                      <p className="text-sm text-muted-foreground">Alerts for new requirements that match your skills.</p>
                    </div>
                    <Switch
                      id="pref-newreq"
                      checked={trainerEmailPrefs.newRequirementMatch}
                      onCheckedChange={(v) => handleToggleTrainerPref("newRequirementMatch", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-messages">Message Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified by email when you receive a new message.</p>
                    </div>
                    <Switch
                      id="pref-messages"
                      checked={trainerEmailPrefs.messages}
                      onCheckedChange={(v) => handleToggleTrainerPref("messages", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                </>
              ) : isVendor ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-newapp">New Application Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified when a trainer applies to one of your requirements.</p>
                    </div>
                    <Switch
                      id="pref-newapp"
                      checked={vendorEmailPrefs.newApplication}
                      onCheckedChange={(v) => handleToggleVendorPref("newApplication", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-withdrew">Trainer Withdrawal Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified when a trainer withdraws their application.</p>
                    </div>
                    <Switch
                      id="pref-withdrew"
                      checked={vendorEmailPrefs.trainerWithdrew}
                      onCheckedChange={(v) => handleToggleVendorPref("trainerWithdrew", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pref-vendor-messages">Message Emails</Label>
                      <p className="text-sm text-muted-foreground">Get notified by email when you receive a new message from a trainer.</p>
                    </div>
                    <Switch
                      id="pref-vendor-messages"
                      checked={vendorEmailPrefs.messages}
                      onCheckedChange={(v) => handleToggleVendorPref("messages", v)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Privacy
              </CardTitle>
              <CardDescription>Manage your visibility on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="profile-vis">Profile Visibility</Label>
                  <p className="text-sm text-muted-foreground">Allow others to find your profile in search.</p>
                </div>
                <Switch id="profile-vis" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="contact-platform">Direct Contact</Label>
                  <p className="text-sm text-muted-foreground">Allow verified users to message you directly.</p>
                </div>
                <Switch id="contact-platform" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {(user?.role === "trainer" || user?.role === "vendor") && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" /> Password Login
                </CardTitle>
                <CardDescription>
                  Set a password so you can sign in with your email and password instead of a magic link every time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSetPassword} className="space-y-4 max-w-sm">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
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
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" disabled={isSavingPassword || !password || !confirmPassword}>
                    {isSavingPassword ? "Saving…" : "Save Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Account
              </CardTitle>
              <CardDescription>Manage your current session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user && (
                <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                        {user.role} Account
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
