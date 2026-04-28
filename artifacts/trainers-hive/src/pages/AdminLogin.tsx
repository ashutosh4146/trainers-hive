import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_PASSCODE = "trainershive@admin";

export default function AdminLogin() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (passcode !== ADMIN_PASSCODE) {
      setError("Incorrect passcode.");
      return;
    }

    setIsLoading(true);
    switchUser.mutate(
      { data: { role: "admin" } },
      {
        onSuccess: (user) => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          signIn({
            signedIn: true,
            name: user.name ?? "Admin",
            email: user.email ?? "",
            role: "admin",
          });
          toast({ title: "Welcome, Admin", description: "You are signed in as administrator." });
          navigate("/dashboard");
        },
        onError: () => {
          setError("Admin account not found. Make sure the database is seeded.");
          setIsLoading(false);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      <header className="flex items-center gap-2 px-8 py-5 border-b bg-background/80 backdrop-blur">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl tracking-tight text-primary">Trainers Hive</span>
        <span className="ml-2 text-xs text-muted-foreground border rounded px-1.5 py-0.5">Admin</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-primary/10 p-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
            <p className="text-sm text-muted-foreground">Internal staff only</p>
          </div>

          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sign in with passcode</CardTitle>
              <CardDescription className="text-xs">Enter the admin passcode to access the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="passcode">Passcode</Label>
                  <Input
                    id="passcode"
                    type="password"
                    placeholder="Enter admin passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoComplete="current-password"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || !passcode}>
                  {isLoading ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Not an admin?{" "}
            <button type="button" className="text-primary underline underline-offset-2 hover:text-primary/80" onClick={() => navigate("/login")}>
              Go to regular login
            </button>
          </p>
        </div>
      </div>

      <footer className="text-center text-xs text-muted-foreground py-5 border-t">
        &copy; {new Date().getFullYear()} Trainers Hive. Internal use only.
      </footer>
    </div>
  );
}
