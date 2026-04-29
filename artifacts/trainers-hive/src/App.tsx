import React, { Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CursorLoader } from "@/components/ui/cursor-loader";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const queryClient = new QueryClient();

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
const Signup = React.lazy(() => import("./pages/Signup"));
const Login = React.lazy(() => import("./pages/Login"));
const AdminLogin = React.lazy(() => import("./pages/AdminLogin"));
const AuthCallback = React.lazy(() => import("./pages/AuthCallback"));
const HireUs = React.lazy(() => import("./pages/HireUs"));

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  const { isSignedIn } = useAuth();

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/login">
          {isSignedIn ? <Redirect to="/dashboard" /> : <Login />}
        </Route>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/auth/callback" component={AuthCallback} />

        <Route>
          <AppLayout>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/trainers" component={Trainers} />
              <Route path="/trainers/:id" component={TrainerDetail} />
              <Route path="/requirements" component={Requirements} />
              <Route path="/requirements/new">
                <PrivateRoute component={NewRequirement} />
              </Route>
              <Route path="/requirements/:id" component={RequirementDetail} />
              <Route path="/dashboard">
                <PrivateRoute component={Dashboard} />
              </Route>
              <Route path="/profile">
                <PrivateRoute component={Profile} />
              </Route>
              <Route path="/settings">
                <PrivateRoute component={Settings} />
              </Route>
              <Route path="/hire-us" component={HireUs} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthTokenGetter(() => user.getIdToken());
      } else {
        setAuthTokenGetter(null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <CursorLoader />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
