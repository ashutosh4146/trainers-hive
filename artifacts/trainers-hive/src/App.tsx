import React, { Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Lazy load pages for better performance
const Home = React.lazy(() => import("./pages/Home"));
const Trainers = React.lazy(() => import("./pages/Trainers"));
const TrainerDetail = React.lazy(() => import("./pages/TrainerDetail"));
const Requirements = React.lazy(() => import("./pages/Requirements"));
const RequirementDetail = React.lazy(() => import("./pages/RequirementDetail"));
const NewRequirement = React.lazy(() => import("./pages/NewRequirement"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Settings = React.lazy(() => import("./pages/Settings"));
const AppLayout = React.lazy(() => import("./components/layout/AppLayout"));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AppLayout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/trainers" component={Trainers} />
          <Route path="/trainers/:id" component={TrainerDetail} />
          <Route path="/requirements" component={Requirements} />
          <Route path="/requirements/new" component={NewRequirement} />
          <Route path="/requirements/:id" component={RequirementDetail} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={Profile} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
