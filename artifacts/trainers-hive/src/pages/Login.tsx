import React, { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Building2, GraduationCap, Users } from "lucide-react";
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

const ROLES: { id: UserRole; label: string; icon: React.ReactNode }[] = [
  { id: "trainer",  label: "Trainer",           icon: <Users className="h-5 w-5" /> },
  { id: "vendor",   label: "Vendor",             icon: <Building2 className="h-5 w-5" /> },
  { id: "college",  label: "College / Company",  icon: <GraduationCap className="h-5 w-5" /> },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, auth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const switchUser = useSwitchUser();

  React.useEffect(() => {
    if (auth?.signedIn) navigate("/dashboard");
  }, [auth]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedRole) { errs.role = "Select a role to continue."; }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !validate()) return;

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
          toast({ title: "Sign in failed", description: "Could not complete sign-in. Try again.", variant: "destructive" });
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
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          <Card className="border-2">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
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

                <Button type="submit" size="lg" className="w-full" disabled={switchUser.isPending}>
                  {switchUser.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            New to Trainers Hive?{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
              onClick={() => navigate("/signup")}
            >
              Create an account
            </button>
          </p>
        </div>
      </div>

      <footer className="text-center text-xs text-muted-foreground py-5 border-t">
        &copy; {new Date().getFullYear()} Trainers Hive. A trusted B2B training marketplace.
      </footer>
    </div>
  );
}
