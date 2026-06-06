import React from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, LayoutDashboard, Settings, User as UserIcon, LogOut, Plus, Sun, Moon, FileSignature, Users, Building, Briefcase } from "lucide-react";
import { useAuth, getRoleLabel, type UserRole } from "@/hooks/useAuth";
import { signOutFirebase } from "@/lib/firebase";

export function Navbar() {
  const { auth, signOut, isSignedIn } = useAuth();
  const { data: user } = useGetCurrentUser({
    query: {
      enabled: isSignedIn,
      queryKey: getGetCurrentUserQueryKey(),
    },
  });
  const { resolvedTheme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    localStorage.removeItem("th_session_token");
    signOut();
    queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
    navigate("/");
    try { await signOutFirebase(); } catch { /* ignore */ }
  };

  const displayName = user?.name || auth?.name || "User";
  const displayEmail = user?.email || auth?.email || "";
  const displayRole = user?.role ? getRoleLabel(user.role as UserRole) : (auth ? getRoleLabel(auth.role) : "");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <Activity className="h-6 w-6" />
            <span>Trainers Hive</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {isSignedIn && auth?.role === "admin" ? (
              <>
                <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Users className="h-4 w-4" /> Trainers
                </Link>
                <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Briefcase className="h-4 w-4" /> Requirements
                </Link>
                <Link href="/vendors" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Building className="h-4 w-4" /> Vendors
                </Link>
                <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              </>
            ) : (
              <>
                {isSignedIn && (
                  <>
                    <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors">Trainers</Link>
                    <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors">Requirements</Link>
                  </>
                )}
                {isSignedIn && auth?.role === "vendor" && (
                  <Link href="/hire-us" className="font-semibold text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-full px-3 py-0.5 text-xs bg-primary/5">Hire Us</Link>
                )}
                {isSignedIn && (
                  <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                )}
                {isSignedIn && auth?.role === "vendor" && (
                  <Link href="/requirements/new" className="hidden sm:flex ml-2">
                    <Button size="sm" className="gap-1 shadow-sm h-8">
                      <Plus className="h-4 w-4" /> Post Requirement
                    </Button>
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark"
              ? <Sun className="h-5 w-5 text-muted-foreground" />
              : <Moon className="h-5 w-5 text-muted-foreground" />
            }
          </button>

          {!isSignedIn ? (
            <div className="flex items-center gap-2 ml-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button>
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <DropdownMenu>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user?.avatarUrl} alt={displayName} />
                          <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <DropdownMenuContent className="w-60" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                        <p className="text-xs font-semibold text-primary mt-1 uppercase tracking-wider">{displayRole}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/profile">
                      <DropdownMenuItem className="cursor-pointer">
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/dashboard">
                      <DropdownMenuItem className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                    </Link>
                    {auth?.role !== "admin" && (
                      <Link href="/agreements">
                        <DropdownMenuItem className="cursor-pointer">
                          <FileSignature className="mr-2 h-4 w-4" />
                          <span>Agreements</span>
                        </DropdownMenuItem>
                      </Link>
                    )}
                    <Link href="/settings">
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="bottom" className="font-medium">
                  Hi, {displayName.split(" ")[0]}!
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </header>
  );
}
