import React from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Activity, LayoutDashboard, Settings, User as UserIcon, LogOut, Plus } from "lucide-react";
import { useAuth, getRoleLabel } from "@/hooks/useAuth";

export function Navbar() {
  const { data: user } = useGetCurrentUser();
  const { auth, signOut, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    signOut();
    queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    navigate("/login");
  };

  const displayName = auth?.name || user?.name || "User";
  const displayEmail = auth?.email || user?.email || "";
  const displayRole = auth ? getRoleLabel(auth.role) : (user?.role || "");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <Activity className="h-6 w-6" />
            <span>Trainers Hive</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">Marketplace</Link>
            <Link href="/trainers" className="text-muted-foreground hover:text-primary transition-colors">Trainers</Link>
            <Link href="/requirements" className="text-muted-foreground hover:text-primary transition-colors">Requirements</Link>
            {isSignedIn && (
              <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            )}
            {isSignedIn && (auth?.role === "vendor" || auth?.role === "college") && (
              <Link href="/requirements/new" className="hidden sm:flex ml-2">
                <Button size="sm" className="gap-1 shadow-sm h-8">
                  <Plus className="h-4 w-4" /> Post Requirement
                </Button>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign In</Button>
              <Button size="sm" onClick={() => navigate("/signup")}>Sign Up</Button>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatarUrl} alt={displayName} />
                    <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
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
          )}
        </div>
      </div>
    </header>
  );
}
