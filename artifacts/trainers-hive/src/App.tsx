import React, { Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth, clearAuthState } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  setAuthTokenGetter,
  useGetCurrentUser,
  useGetTrainer,
  getGetCurrentUserQueryKey,
  getGetTrainerQueryKey,
  type TrainerDetail,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Helper: check if a JWT is expired without a library dependency.
// ---------------------------------------------------------------------------
function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch {
    return true; // unparseable → treat as expired
  }
}

// Initialize auth token getter synchronously at module load so the very first
// React Query requests (which fire before useEffect) carry the stored JWT.
// Skip expired tokens so they don't cause immediate 401s on load.
const _initialToken = localStorage.getItem("th_session_token");
if (_initialToken && !isJwtExpired(_initialToken)) {
  setAuthTokenGetter(() => Promise.resolve(_initialToken));
} else if (_initialToken) {
  // Token is expired — clear it now so the next login is clean
  localStorage.removeItem("th_session_token");
}

// ---------------------------------------------------------------------------
// QueryClient — global 401 handler signs the user out automatically so they
// are not stuck in an infinite 401 loop with stale / expired credentials.
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if ((error as { status?: number })?.status === 401) {
        localStorage.removeItem("th_session_token");
        setAuthTokenGetter(null);
        clearAuthState();
        // Redirect to login without clobbering the back-stack
        if (!window.location.pathname.startsWith("/login") &&
            !window.location.pathname.startsWith("/signup")) {
          window.location.replace("/login");
        }
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry 401s — auto sign-out already handles them
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});

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
const Support = React.lazy(() => import("./pages/Support"));
const AboutUs = React.lazy(() => import("./pages/AboutUs"));
const TermsAndConditions = React.lazy(() => import("./pages/TermsAndConditions"));
const Messages = React.lazy(() => import("./pages/Messages"));
const SkillsDemand = React.lazy(() => import("./pages/SkillsDemand"));
const InquiryDetail = React.lazy(() => import("./pages/InquiryDetail"));
const MyAgreements = React.lazy(() => import("./pages/MyAgreements"));
const Vendors = React.lazy(() => import("./pages/Vendors"));

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect to="/login" />;
  return <Component />;
}

function VendorRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, auth } = useAuth();
  if (!isSignedIn) return <Redirect to="/login" />;
  if (auth?.role !== "vendor") return <Redirect to="/" />;
  return <Component />;
}

function isTrainerProfileComplete(trainer: TrainerDetail | undefined): boolean {
  if (!trainer) return false;
  return !!(
    trainer.name?.trim() &&
    trainer.mainSkill?.trim() &&
    trainer.location?.trim() &&
    trainer.trainerType &&
    (trainer.languages ?? []).length > 0
  );
}

function TrainerRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, auth } = useAuth();
  const isTrainer = auth?.role === "trainer";

  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser({
    query: { enabled: !!isSignedIn && isTrainer, queryKey: getGetCurrentUserQueryKey() },
  });

  const trainerId = isTrainer ? (currentUser?.trainerId ?? "") : "";
  const { data: trainer, isLoading: trainerLoading } = useGetTrainer(trainerId, {
    query: { enabled: !!trainerId, queryKey: getGetTrainerQueryKey(trainerId) },
  });

  if (!isSignedIn) return <Redirect to="/login" />;
  if (!isTrainer) return <Component />;
  if (userLoading || (!!trainerId && trainerLoading)) return <div className="min-h-screen" />;

  if (!isTrainerProfileComplete(trainer)) return <Redirect to="/profile" />;
  return <Component />;
}

function Router() {
  const { isSignedIn } = useAuth();

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
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
                <TrainerRoute component={Dashboard} />
              </Route>
              <Route path="/profile">
                <PrivateRoute component={Profile} />
              </Route>
              <Route path="/settings">
                <PrivateRoute component={Settings} />
              </Route>
              <Route path="/hire-us">
                <PrivateRoute component={HireUs} />
              </Route>
              <Route path="/messages">
                <PrivateRoute component={Messages} />
              </Route>
              <Route path="/inquiries/:id">
                <PrivateRoute component={InquiryDetail} />
              </Route>
              <Route path="/agreements">
                <PrivateRoute component={MyAgreements} />
              </Route>
              <Route path="/support" component={Support} />
              <Route path="/about" component={AboutUs} />
              <Route path="/terms" component={TermsAndConditions} />
              <Route path="/skills-demand" component={SkillsDemand} />
              <Route path="/vendors" component={Vendors} />
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
    // Restore app JWT from localStorage immediately (before Firebase resolves)
    // so that password-login sessions survive page refreshes without a flicker.
    const storedToken = localStorage.getItem("th_session_token");
    if (storedToken && !isJwtExpired(storedToken)) {
      setAuthTokenGetter(() => Promise.resolve(storedToken));
    } else if (storedToken) {
      localStorage.removeItem("th_session_token");
    }

    // Firebase auth state listener — takes priority once resolved.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Firebase user present — use Firebase ID token (most up-to-date).
        setAuthTokenGetter(() => user.getIdToken());
        if (!localStorage.getItem("th_session_token")) {
          user.getIdToken().then((firebaseToken) => {
            fetch("/api/auth/session-token", {
              headers: { Authorization: `Bearer ${firebaseToken}` },
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { sessionToken?: string } | null) => {
                if (data?.sessionToken) {
                  localStorage.setItem("th_session_token", data.sessionToken);
                }
              })
              .catch(() => {});
          }).catch(() => {});
        }
      } else {
        // No Firebase user — fall back to app JWT if one is stored and valid.
        const jwt = localStorage.getItem("th_session_token");
        if (jwt && !isJwtExpired(jwt)) {
          setAuthTokenGetter(() => Promise.resolve(jwt));
        } else if (jwt) {
          // JWT is expired and Firebase has no session — sign out cleanly
          localStorage.removeItem("th_session_token");
          clearAuthState();
        }
      }
    });
    return unsubscribe;
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
