import React from "react";
import { motion } from "framer-motion";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Bell, Moon, Sun, Lock, User, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { data: user } = useGetCurrentUser();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleSignOut = () => {
    toast({
      title: "Demo Session",
      description: "This is a demo environment. Sign out is simulated.",
    });
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
                <Bell className="h-5 w-5 text-primary" /> Notifications
              </CardTitle>
              <CardDescription>Choose what updates you want to receive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-digest">Daily Email Digest</Label>
                  <p className="text-sm text-muted-foreground">Receive a daily summary of platform activity.</p>
                </div>
                <Switch id="email-digest" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="app-updates">Application Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified when status changes on your applications.</p>
                </div>
                <Switch id="app-updates" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="new-opps">New Opportunities</Label>
                  <p className="text-sm text-muted-foreground">Alerts for new requirements matching your skills.</p>
                </div>
                <Switch id="new-opps" />
              </div>
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
                  <Button variant="destructive" onClick={handleSignOut}>Sign Out</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
