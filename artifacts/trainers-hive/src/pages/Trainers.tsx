import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  useListTrainers,
  getListTrainersQueryKey,
  useListSkills,
  getListSkillsQueryKey,
  useGetCurrentUser,
  useDeleteTrainer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminRemoveButton } from "@/components/AdminRemoveButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Star, MapPin, Briefcase, Filter, X, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Trainers() {
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState<string>("all");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [minExp, setMinExp] = useState([0]);
  const [sort, setSort] = useState<"rating" | "experience" | "recent">("rating");

  // Add debouncing in a real app, but for now we pass directly to keep it simple and responsive
  const queryParams = {
    ...(search ? { q: search } : {}),
    ...(skill !== "all" ? { skill } : {}),
    ...(location ? { location } : {}),
    ...(remote ? { remote: true } : {}),
    ...(minExp[0] > 0 ? { minExperience: minExp[0] } : {}),
    sort,
  };

  const { data: trainers, isLoading } = useListTrainers(queryParams, {
    query: { queryKey: getListTrainersQueryKey(queryParams) }
  });

  const { data: skillsData } = useListSkills({
    query: { queryKey: getListSkillsQueryKey() }
  });

  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const deleteTrainer = useDeleteTrainer();
  const queryClient = useQueryClient();

  const allSkills = skillsData?.flatMap(cat => cat.skills) || [];

  const clearFilters = () => {
    setSearch("");
    setSkill("all");
    setLocation("");
    setRemote(false);
    setMinExp([0]);
    setSort("rating");
  };

  const activeFiltersCount = (search ? 1 : 0) + (skill !== "all" ? 1 : 0) + (location ? 1 : 0) + (remote ? 1 : 0) + (minExp[0] > 0 ? 1 : 0);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 lg:w-72 shrink-0 self-start sticky top-24 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filters
          </h2>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground">
              Clear <X className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Name or keyword..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill">Primary Skill</Label>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger id="skill">
                <SelectValue placeholder="Any skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any skill</SelectItem>
                {allSkills.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="City, Country..."
                className="pl-9"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="remote-toggle" className="cursor-pointer">Remote Only</Label>
              <Switch id="remote-toggle" checked={remote} onCheckedChange={setRemote} />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>Min Experience</Label>
              <span className="text-sm font-medium text-muted-foreground">{minExp[0]} years</span>
            </div>
            <Slider
              value={minExp}
              onValueChange={setMinExp}
              max={30}
              step={1}
              className="pt-2"
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expert Trainers</h1>
            <p className="text-muted-foreground mt-1">
              Find and hire verified training professionals.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Label className="whitespace-nowrap text-sm text-muted-foreground">Sort by:</Label>
            <Select value={sort} onValueChange={(v: any) => setSort(v)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="experience">Most Experience</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoading ? (
             Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : trainers?.length ? (
            trainers.map((trainer) => (
              <div key={trainer.id} className="relative">
                {isAdmin && (
                  <div className="absolute top-3 right-3 z-10">
                    <AdminRemoveButton
                      label={`trainer ${trainer.name}`}
                      description={`This permanently removes ${trainer.name} from the marketplace, along with all their reviews and applications. This cannot be undone.`}
                      successMessage={`${trainer.name} has been removed from the marketplace.`}
                      onConfirm={async () => {
                        await deleteTrainer.mutateAsync({ id: trainer.id });
                        await queryClient.invalidateQueries({
                          queryKey: getListTrainersQueryKey(queryParams),
                        });
                      }}
                    />
                  </div>
                )}
                <Link href={`/trainers/${trainer.id}`}>
                <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group flex flex-col">
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <Avatar className="h-12 w-12 border border-border">
                      <AvatarImage src={trainer.avatarUrl} alt={trainer.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">{trainer.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pr-8">
                      <CardTitle className="text-lg flex items-center gap-2 truncate">
                        {trainer.name}
                        {trainer.verified && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 px-1.5 py-0 h-5">Verified</Badge>}
                      </CardTitle>
                      <CardDescription className="truncate text-sm text-muted-foreground mt-1">
                        {trainer.headline}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 flex-1 flex flex-col justify-between">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary">
                        {trainer.mainSkill}
                      </Badge>
                      {trainer.subSkills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">
                          {skill}
                        </Badge>
                      ))}
                      {trainer.subSkills.length > 3 && (
                        <Badge variant="outline" className="font-normal text-muted-foreground border-dashed">
                          +{trainer.subSkills.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-3 pt-3 border-t text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium text-foreground">{trainer.rating.toFixed(1)}</span>
                        <span>({trainer.reviewCount})</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 font-semibold text-foreground">
                        ${trainer.hourlyRate}/hr
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span>{trainer.experienceYears}y exp</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate max-w-[100px] text-right">{trainer.location}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              </div>
            ))
          ) : (
            <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/30 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No trainers found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any trainers matching your current filters. Try adjusting your search criteria.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
