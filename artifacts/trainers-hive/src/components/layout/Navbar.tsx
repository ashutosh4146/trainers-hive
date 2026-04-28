import React from "react";
import { Link } from "wouter";
import { useGetCurrentUser, useSwitchUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
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
import { Activity, LayoutDashboard, Search, Users, Settings, User as UserIcon, RefreshCw, Briefcase, Plus } from "lucide-react";

export function Navbar() {
  const { data: user } = useGetCurrentUser();
  const switchUser = useSwitchUser();
  const queryClient = useQueryClient();

  const handleSwitchUser = (role: "vendor" | "trainer" | "admin") => {
    switchUser.mutate(
      { data: { role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
      }
    );
  };

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
            {user && (
              <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            )}
            {user?.role === "vendor" && (
              <Link href="/requirements/new" className="hidden sm:flex ml-2">
                <Button size="sm" className="gap-1 shadow-sm h-8">
                  <Plus className="h-4 w-4" /> Post Requirement
                </Button>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center rounded-full bg-muted p-1 text-sm border border-border">
            <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demo Role:</span>
            <Button
              variant={user?.role === "vendor" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => handleSwitchUser("vendor")}
              disabled={switchUser.isPending}
            >
              Vendor
            </Button>
            <Button
              variant={user?.role === "trainer" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => handleSwitchUser("trainer")}
              disabled={switchUser.isPending}
            >
              Trainer
            </Button>
            <Button
              variant={user?.role === "admin" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => handleSwitchUser("admin")}
              disabled={switchUser.isPending}
            >
              Admin
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} alt={user?.name || "User"} />
                  <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-xs font-semibold text-primary mt-1 uppercase tracking-wider">
                    {user?.role}
                  </p>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
