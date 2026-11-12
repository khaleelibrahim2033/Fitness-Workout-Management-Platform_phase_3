import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { send, request } from "./api";
import type { Analytics, Badge, Comparison, DashboardData, Exercise, Goal, GoalInput, Meal, Notification, NutritionSummary, ProgressDay, Recommendation, Report, TokenResponse, User, UserSettings, WaterSummary, Workout, WorkoutInput, WorkoutPlan } from "./api";

type AuthValue = {
  user: User | null;
  setSession: (session: TokenResponse) => void;
  signOut: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);

function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Authentication context is missing");
  return context;
}

function useLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("fittrack_token")));
  useEffect(() => {
    if (!localStorage.getItem("fittrack_token")) return;
    request<User>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("fittrack_token"))
      .finally(() => setChecking(false));
  }, []);

  const auth = useMemo<AuthValue>(
    () => ({
      user,
      setSession: (session) => {
        localStorage.setItem("fittrack_token", session.access_token);
        setUser(session.user);
      },
      signOut: () => {
        localStorage.removeItem("fittrack_token");
        setUser(null);
      },
    }),
    [user],
  );

  if (checking) return <div className="loading-screen">Getting your space ready…</div>;
  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/water" element={<WaterPage />} />
          <Route path="/plans" element={<WorkoutPlansPage />} />
          <Route path="/exercises" element={<ExerciseLibraryPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function ProtectedLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [reminderError, setReminderError] = useState("");
  const { data: notifications, refresh: refreshNotifications } = useLoad(
    () => request<Notification[]>("/notifications"),
    [user?.id, location.pathname],
  );
  useEffect(() => {
    window.addEventListener("fittrack-notifications-updated", refreshNotifications);
    return () => window.removeEventListener("fittrack-notifications-updated", refreshNotifications);
  }, [refreshNotifications]);
  useEffect(() => {
    const showReminderError = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") setReminderError(event.detail);
    };
    const clearReminderError = () => setReminderError("");
    window.addEventListener("fittrack-reminder-error", showReminderError);
    window.addEventListener("fittrack-reminder-success", clearReminderError);
    return () => {
      window.removeEventListener("fittrack-reminder-error", showReminderError);
      window.removeEventListener("fittrack-reminder-success", clearReminderError);
    };
  }, []);
  if (!user) return <Navigate to="/login" replace />;
  const unread = notifications?.filter((item) => !item.is_read).length ?? 0;
  return (
    <div className="app-shell">
      <ReminderScheduler user={user} />
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">f</span>
          <span>fittrack<span className="brand-period">.</span></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          <NavLink to="/" end><span className="nav-icon">◫</span> Overview</NavLink>
          <NavLink to="/workouts"><span className="nav-icon">↗</span> Workouts</NavLink>
          <NavLink to="/nutrition"><span className="nav-icon">◒</span> Nutrition</NavLink>
          <NavLink to="/water"><span className="nav-icon">◌</span> Water</NavLink>
          <NavLink to="/plans"><span className="nav-icon">▦</span> Planner</NavLink>
          <NavLink to="/exercises"><span className="nav-icon">⌘</span> Exercises</NavLink>
          <NavLink to="/recommendations"><span className="nav-icon">✦</span> For you</NavLink>
          <NavLink to="/goals"><span className="nav-icon">◎</span> Goals</NavLink>
          <NavLink to="/reports"><span className="nav-icon">⌁</span> Reports</NavLink>
          <NavLink to="/analytics"><span className="nav-icon">▤</span> Insights</NavLink>
          <NavLink to="/comparison"><span className="nav-icon">↗</span> Compare</NavLink>
          <NavLink to="/reminders"><span className="nav-icon">◷</span> Reminders</NavLink>
          <NavLink to="/notifications">
            <span className="nav-icon">🔔</span> Notifications
            {unread > 0 && <span className="nav-count">{unread}</span>}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy"><strong>{user.username}</strong><span>Personal account</span></div>
          <button className="icon-button signout" title="Sign out" onClick={signOut}>↗</button>
        </div>
      </aside>
      <main className="main-area">{reminderError && <div className="form-error reminder-global-error" role="alert">{reminderError}</div>}<Outlet /></main>
    </div>
  );
}

function ReminderScheduler({ user }: { user: User }) {
  const { data: settings, error, refresh } = useLoad(() => request<UserSettings>("/settings"), [user.id]);

  useEffect(() => {
    if (error) window.dispatchEvent(new CustomEvent("fittrack-reminder-error", { detail: error }));
  }, [error]);
  useEffect(() => {
    window.addEventListener("fittrack-settings-updated", refresh);
    return () => window.removeEventListener("fittrack-settings-updated", refresh);
  }, [refresh]);

  useEffect(() => {
    if (!settings) return;
    const reminderTypes = [
      { key: "workout", enabled: settings.workout_reminder_enabled, time: settings.workout_reminder_time, title: "Workout reminder", message: "A little movement can make your day. Start a workout when you're ready." },
      { key: "meal", enabled: settings.meal_reminder_enabled, time: settings.meal_reminder_time, title: "Meal reminder", message: "Take a moment for your next meal and log it in FitTrack." },
      { key: "water", enabled: settings.water_reminder_enabled, time: settings.water_reminder_time, title: "Water reminder", message: "Pause for a drink of water and keep your hydration goal in sight." },
    ] as const;
    const checkReminders = () => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = localDateString(now);
      for (const reminder of reminderTypes) {
        if (!reminder.enabled || reminder.time !== time) continue;
        const storageKey = `fittrack_reminder_${user.id}_${reminder.key}_${today}`;
        if (localStorage.getItem(storageKey)) continue;
        localStorage.setItem(storageKey, "pending");
        void send<Notification>("/notifications", "POST", {
          title: reminder.title,
          message: reminder.message,
        }).then(() => {
          localStorage.setItem(storageKey, "sent");
          window.dispatchEvent(new Event("fittrack-notifications-updated"));
          window.dispatchEvent(new Event("fittrack-reminder-success"));
          if (window.Notification?.permission === "granted") {
            new window.Notification(reminder.title, { body: reminder.message });
          }
        }).catch((reason: unknown) => {
          localStorage.removeItem(storageKey);
          window.dispatchEvent(new CustomEvent("fittrack-reminder-error", {
            detail: reason instanceof Error ? reason.message : "Could not create reminder alert",
          }));
        });
      }
    };
    checkReminders();
    const interval = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(interval);
  }, [settings, user.id]);

  return null;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = isRegister
        ? await send<TokenResponse>(`/auth/${mode}`, "POST", Object.fromEntries(form.entries()))
        : await request<TokenResponse>("/auth/login", {
            method: "POST",
            body: new URLSearchParams({
              username: String(form.get("username") ?? ""),
              password: String(form.get("password") ?? ""),
            }),
          });
      setSession(session);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-art">
        <Link to="/" className="brand auth-brand"><span className="brand-mark">f</span><span>fittrack<span className="brand-period">.</span></span></Link>
        <div className="art-copy">
          <div className="eyebrow"><span className="pulse-dot" /> YOUR ROUTINE, REIMAGINED</div>
          <h1>Small steps.<br />Stronger <em>you.</em></h1>
          <p>A calmer way to build consistency, celebrate progress, and feel good in your body.</p>
        </div>
        <div className="art-stat"><span className="stat-spark">↗</span><span><strong>One day at a time</strong><small>Progress over perfection</small></span><span className="stat-bars"><i /><i /><i /><i /><i /><i /><i /></span></div>
        <div className="art-orb orb-one" /><div className="art-orb orb-two" />
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-auth-brand"><span className="brand-mark">f</span> fittrack.</div>
          <p className="eyebrow muted">{isRegister ? "START YOUR JOURNEY" : "WELCOME BACK"}</p>
          <h2>{isRegister ? "Create your account" : "Good to see you."}</h2>
          <p className="form-subtitle">{isRegister ? "Your next chapter starts with a single step." : "Ready to pick up where you left off?"}</p>
          <form onSubmit={submit} className="form-stack">
            {isRegister && <label>Your name<input name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]+" placeholder="e.g. alexmorgan" autoComplete="username" /></label>}
            {isRegister ? (
              <label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="email" /></label>
            ) : (
              <label>Username or email<input name="username" type="text" required placeholder="Your username" autoComplete="username" /></label>
            )}
            <label>Password<input name="password" type="password" required minLength={isRegister ? 8 : 1} maxLength={72} placeholder={isRegister ? "At least 8 characters" : "Your password"} autoComplete={isRegister ? "new-password" : "current-password"} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary submit-button" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create account" : "Sign in"} <span>→</span></button>
          </form>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to FitTrack?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
          <p className="auth-privacy">By continuing, you agree to keep showing up for yourself.</p>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow muted">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</header>;
}

function StatCard({ label, value, unit, detail, icon, tone }: { label: string; value: string | number; unit: string; detail: string; icon: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-detail">{detail}</div></article>;
}

function Dashboard() {
  const { user } = useAuth();
  const { data: workouts, loading: workoutsLoading, error: workoutError } = useLoad(() => request<Workout[]>("/workouts"), [user?.id]);
  const { data: progress, loading: progressLoading } = useLoad(() => request<ProgressDay[]>("/progress"), [user?.id]);
  const { data: dashboard } = useLoad(() => request<DashboardData>("/dashboard"), [user?.id]);
  const [earnedBadge, setEarnedBadge] = useState<Badge | null>(null);
  const today = localDateString(new Date());
  const todayWorkouts = workouts?.filter((workout) => workout.workout_date === today) ?? [];
  const todayCalories = todayWorkouts.reduce((sum, workout) => sum + workout.calories_burned, 0);
  const week = progress?.slice(-7) ?? [];
  const weekCalories = week.reduce((sum, day) => sum + day.total_calories, 0);
  const weekWorkouts = week.reduce((sum, day) => sum + day.total_workouts, 0);
  const chartData = (week.length ? week : []).map((day) => ({
    ...day,
    label: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
  }));
  const latest = workouts?.slice(0, 4) ?? [];
  useEffect(() => {
    if (!dashboard) return;
    const key = `fittrack_seen_badges_${user?.id}`;
    const seen = (localStorage.getItem(key) ?? "").split(",").filter(Boolean);
    setEarnedBadge(dashboard.badges.find((badge) => badge.earned_at && !seen.includes(String(badge.id))) ?? null);
  }, [dashboard, user?.id]);

  function dismissBadge() {
    if (!dashboard) return;
    const key = `fittrack_seen_badges_${user?.id}`;
    const seen = (localStorage.getItem(key) ?? "").split(",").filter(Boolean);
    if (earnedBadge) seen.push(String(earnedBadge.id));
    const nextSeen = [...new Set(seen)];
    localStorage.setItem(key, nextSeen.join(","));
    setEarnedBadge(dashboard.badges.find((badge) => badge.earned_at && !nextSeen.includes(String(badge.id))) ?? null);
  }

  return <div className="page-content">
    <PageHeader eyebrow="YOUR FITNESS, IN FOCUS" title={`Good ${getGreeting()}, ${user?.username}.`} subtitle="A little progress adds up. Here's how you're doing." action={<div className="today-chip"><span /> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>} />
    <section className="stats-grid">
      <StatCard label="Workouts this week" value={weekWorkouts} unit="sessions" detail="Keep your rhythm going" icon="↗" tone="lime" />
      <StatCard label="Calories this week" value={weekCalories.toLocaleString()} unit="kcal" detail="Energy put to good use" icon="✳" tone="peach" />
      <StatCard label="Today's activity" value={todayWorkouts.length} unit={todayWorkouts.length === 1 ? "workout" : "workouts"} detail={`${todayCalories.toLocaleString()} kcal burned today`} icon="◷" tone="blue" />
      <StatCard label="Current streak" value={dashboard?.streak.current_streak ?? 0} unit="days" detail={`Best: ${dashboard?.streak.longest_streak ?? 0} days`} icon="✦" tone="lavender" />
    </section>
    <section className="content-grid dashboard-grid">
      <article className="panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">THE LAST 7 DAYS</p><h2>Your activity</h2></div><span className="chart-legend"><i /> Calories</span></div>
        <div className="chart-wrap">
          {progressLoading ? <div className="empty-state">Loading your progress…</div> : chartData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7e548" stopOpacity={0.38} /><stop offset="100%" stopColor="#b7e548" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} dy={12} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf", boxShadow: "0 8px 24px #17200c12" }} /><Area type="monotone" dataKey="total_calories" name="Calories" stroke="#88ae21" strokeWidth={2.5} fill="url(#calorieFill)" activeDot={{ r: 5, fill: "#88ae21" }} /></AreaChart></ResponsiveContainer> : <div className="empty-state">Your activity will show up here once you log a workout.</div>}
        </div>
      </article>
      <article className="panel today-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">A GOOD PLACE TO START</p><h2>Today's focus</h2></div><span className="focus-icon">✳</span></div>
        <div className="focus-count">{todayWorkouts.length}<span> / 1</span></div>
        <p className="focus-caption">workout logged today</p>
        <div className="focus-progress"><i style={{ width: `${Math.min(todayWorkouts.length * 100, 100)}%` }} /></div>
        <p className="focus-note">{todayWorkouts.length ? "You're showing up for yourself. That's what matters." : "No pressure. Every movement counts, whenever you start."}</p>
        <Link to="/workouts" className="text-link">Log a workout <span>→</span></Link>
      </article>
    </section>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><p className="eyebrow muted">YOUR RECENT MOVEMENT</p><h2>Recent workouts</h2></div><Link to="/workouts" className="text-link">See all <span>→</span></Link></div>
      {workoutError && <p className="form-error">{workoutError}</p>}
      {workoutsLoading ? <div className="empty-state">Loading workouts…</div> : latest.length ? <WorkoutRows workouts={latest} /> : <div className="empty-state">Nothing logged just yet. Your first workout is a great place to begin. <Link to="/workouts">Add a workout →</Link></div>}
    </section>
    <section className="content-grid dashboard-extras">
      <article className="panel">
        <div className="panel-heading"><div><p className="eyebrow muted">MAKE IT HAPPEN</p><h2>Coming up</h2></div><Link to="/plans" className="text-link">Open planner <span>→</span></Link></div>
        {dashboard?.upcoming_workouts.length ? <div className="planned-list">{dashboard.upcoming_workouts.slice(0, 3).map((plan) => <div className="planned-row" key={plan.id}><span className="planned-date">{new Date(`${plan.scheduled_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span><div><strong>{plan.title}</strong><small>{plan.exercises.length ? `${plan.exercises.length} exercises` : "Workout planned"}</small></div></div>)}</div> : <div className="empty-state compact-empty">No workouts planned yet. <Link to="/plans">Schedule one →</Link></div>}
      </article>
      <article className="panel">
        <div className="panel-heading"><div><p className="eyebrow muted">MILESTONES</p><h2>Your badges</h2></div><Link to="/comparison" className="text-link">See progress <span>→</span></Link></div>
        {dashboard?.badges.some((badge) => badge.earned_at) ? <div className="badge-strip">{dashboard.badges.filter((badge) => badge.earned_at).slice(-4).map((badge) => <div className="badge-chip" key={badge.id}><span>{badge.icon}</span><strong>{badge.name}</strong></div>)}</div> : <div className="empty-state compact-empty">Your first milestone is just around the corner.</div>}
      </article>
      <article className="panel">
        <div className="panel-heading"><div><p className="eyebrow muted">KEEP MOVING FORWARD</p><h2>Goal progress</h2></div><Link to="/goals" className="text-link">View goals <span>→</span></Link></div>
        {dashboard?.goals.length ? <div className="dashboard-goals">{dashboard.goals.slice(0, 3).map((goal) => {
          const percent = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
          return <div className="dashboard-goal" key={goal.id}><div><strong>{goal.goal_type}</strong><span>{percent}%</span></div><div className="goal-track"><i style={{ width: `${percent}%` }} /></div></div>;
        })}</div> : <div className="empty-state compact-empty">Set a goal to give your effort a direction. <Link to="/goals">Create one →</Link></div>}
      </article>
    </section>
    {earnedBadge && <div className="achievement-overlay" role="dialog" aria-modal="true" aria-labelledby="achievement-title"><div className="achievement-modal"><button className="icon-button achievement-close" aria-label="Close achievement" onClick={dismissBadge}>×</button><span className="achievement-icon">{earnedBadge.icon}</span><p className="eyebrow muted">NEW ACHIEVEMENT</p><h2 id="achievement-title">{earnedBadge.name}</h2><p>{earnedBadge.description}</p><button className="button button-primary" onClick={dismissBadge}>Keep it up <span>→</span></button></div></div>}
  </div>;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function localDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function WorkoutRows({ workouts, onEdit, onDelete }: { workouts: Workout[]; onEdit?: (workout: Workout) => void; onDelete?: (workout: Workout) => void }) {
  return <div className="workout-list">{workouts.map((workout) => <div className="workout-row" key={workout.id}><div className={`workout-type-icon ${categoryTone(workout.category)}`}>{categoryIcon(workout.category)}</div><div className="workout-name"><strong>{workout.workout_name}</strong><span>{workout.category} · {formatDate(workout.workout_date)}</span></div><div className="workout-metric"><strong>{workout.duration}</strong><span>min</span></div><div className="workout-metric calories"><strong>{workout.calories_burned}</strong><span>kcal</span></div>{(onEdit || onDelete) && <div className="row-actions">{onEdit && <button className="icon-button" title="Edit workout" onClick={() => onEdit(workout)}>✎</button>}{onDelete && <button className="icon-button danger-hover" title="Delete workout" onClick={() => onDelete(workout)}>×</button>}</div>}</div>)}</div>;
}

function categoryIcon(category: Workout["category"]) {
  return category === "Cardio" ? "↗" : category === "Strength" ? "⌁" : "◉";
}
function categoryTone(category: Workout["category"]) {
  return category.toLowerCase();
}
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function WorkoutsPage() {
  const { user } = useAuth();
  const { data: workouts, loading, error, refresh } = useLoad(() => request<Workout[]>("/workouts"), [user?.id]);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timerName, setTimerName] = useState("");
  const [timerCategory, setTimerCategory] = useState<Workout["category"]>("Cardio");
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerSaving, setTimerSaving] = useState(false);

  useEffect(() => {
    if (timerStart === null) return;
    const interval = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - timerStart) / 1000)),
      250,
    );
    return () => window.clearInterval(interval);
  }, [timerStart]);

  async function saveWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const input: WorkoutInput = {
      workout_name: String(values.workout_name),
      category: values.category as WorkoutInput["category"],
      duration: Number(values.duration),
      calories_burned: Number(values.calories_burned),
      workout_date: String(values.workout_date),
    };
    try {
      await send(editing ? `/workouts/${editing.id}` : "/workouts", editing ? "PATCH" : "POST", input);
      setEditing(null);
      setShowForm(false);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not save workout");
    } finally {
      setBusy(false);
    }
  }

  async function removeWorkout(workout: Workout) {
    if (!window.confirm(`Delete "${workout.workout_name}"?`)) return;
    try {
      await send(`/workouts/${workout.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not delete workout");
    }
  }

  async function finishTimedWorkout() {
    if (timerStart === null || timerSaving) return;
    const seconds = Math.max(1, Math.floor((Date.now() - timerStart) / 1000));
    const duration = Math.max(1, Math.ceil(seconds / 60));
    const caloriesPerMinute = timerCategory === "Cardio" ? 7 : timerCategory === "Strength" ? 6 : 3;
    setElapsedSeconds(seconds);
    setTimerStart(null);
    setTimerSaving(true);
    setActionError("");
    try {
      await send("/workouts", "POST", {
        workout_name: timerName.trim(),
        category: timerCategory,
        duration,
        calories_burned: duration * caloriesPerMinute,
        workout_date: localDateString(new Date(timerStart)),
      });
      setTimerName("");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not save timed workout");
    } finally {
      setTimerSaving(false);
    }
  }

  function startEdit(workout: Workout) {
    setEditing(workout);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="page-content">
    <PageHeader eyebrow="MOVEMENT, MADE VISIBLE" title="Your workouts" subtitle="Every session counts. Keep a record of how you move." action={<button className="button button-primary" onClick={() => { setEditing(null); setShowForm((shown) => !shown); }}><span>＋</span> Log a workout</button>} />
    <section className="panel timer-panel">
      <div className="panel-heading"><div><p className="eyebrow muted">LIVE SESSION</p><h2>Workout timer</h2></div><span className="focus-icon">◷</span></div>
      <div className="timer-controls">
        <label>Session name<input value={timerName} onChange={(event) => setTimerName(event.target.value)} maxLength={100} placeholder="e.g. Evening run" disabled={timerStart !== null} /></label>
        <label>Category<select value={timerCategory} onChange={(event) => setTimerCategory(event.target.value as Workout["category"])} disabled={timerStart !== null}><option>Cardio</option><option>Strength</option><option>Yoga</option></select></label>
        <div className="timer-readout" role="timer" aria-live="off">{String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:{String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</div>
        <div className="timer-actions">{timerStart === null ? <button className="button button-primary" disabled={timerSaving} onClick={() => { if (!timerName.trim()) { setActionError("Add a session name before starting the timer."); return; } setActionError(""); setElapsedSeconds(0); setTimerStart(Date.now()); }}>Start workout</button> : <button className="button button-primary" disabled={timerSaving} onClick={() => void finishTimedWorkout()}>{timerSaving ? "Saving…" : "Stop & save workout"}</button>}</div>
      </div>
      <p className="timer-caption">Estimated calories: {Math.max(1, Math.ceil(elapsedSeconds / 60)) * (timerCategory === "Cardio" ? 7 : timerCategory === "Strength" ? 6 : 3)} kcal · based on category and duration.</p>
    </section>
    {(showForm || editing) && <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow muted">{editing ? "UPDATE YOUR SESSION" : "ADD TO YOUR JOURNEY"}</p><h2>{editing ? "Edit workout" : "New workout"}</h2></div><button className="icon-button" onClick={() => { setShowForm(false); setEditing(null); }}>×</button></div><form onSubmit={saveWorkout} className="form-grid">
      <label>Workout name<input name="workout_name" required minLength={2} maxLength={100} defaultValue={editing?.workout_name ?? ""} placeholder="e.g. Morning run" /></label>
      <label>Category<select name="category" defaultValue={editing?.category ?? "Cardio"}><option>Cardio</option><option>Strength</option><option>Yoga</option></select></label>
      <label>Duration (minutes)<input name="duration" type="number" min="1" max="1440" required defaultValue={editing?.duration ?? ""} placeholder="45" /></label>
      <label>Calories burned<input name="calories_burned" type="number" min="0" max="10000" required defaultValue={editing?.calories_burned ?? ""} placeholder="320" /></label>
      <label>Workout date<input name="workout_date" type="date" required defaultValue={editing?.workout_date ?? localDateString(new Date())} /></label>
      {actionError && <div className="form-error full-width">{actionError}</div>}
      <div className="form-actions full-width"><button type="button" className="button button-soft" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add workout"} <span>→</span></button></div>
    </form></section>}
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">YOUR ACTIVITY LOG</p><h2>All workouts <span className="title-count">{workouts?.length ?? 0}</span></h2></div></div>{(error || actionError) && !showForm && <div className="form-error">{error || actionError}</div>}{loading ? <div className="empty-state">Loading workouts…</div> : workouts?.length ? <WorkoutRows workouts={workouts} onEdit={startEdit} onDelete={removeWorkout} /> : <div className="empty-state">Your log is ready when you are. Add your first workout to get started.</div>}</section>
  </div>;
}

function NutritionPage() {
  const { user } = useAuth();
  const today = localDateString(new Date());
  const { data: nutrition, loading, error, refresh } = useLoad(
    () => request<NutritionSummary>(`/meals?meal_date=${today}`),
    [user?.id, today],
  );
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setActionError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await send("/meals", "POST", {
        meal_type: values.meal_type,
        food_name: String(values.food_name).trim(),
        calories: Number(values.calories),
        protein: Number(values.protein),
        carbs: Number(values.carbs),
        fats: Number(values.fats),
      });
      form.reset();
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not add meal");
    } finally {
      setBusy(false);
    }
  }

  async function removeMeal(meal: Meal) {
    try {
      await send(`/meals/${meal.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not remove meal");
    }
  }

  return <div className="page-content">
    <PageHeader eyebrow="FUEL YOUR DAY" title="Nutrition" subtitle="Keep a simple record of what you eat and the nutrients you take in." action={<div className="today-chip"><span /> {formatDate(today)}</div>} />
    <section className="stats-grid nutrition-stats">
      <StatCard label="Calories today" value={(nutrition?.total_calories ?? 0).toLocaleString()} unit="kcal" detail="Food logged today" icon="✳" tone="peach" />
      <StatCard label="Protein" value={(nutrition?.total_protein ?? 0).toFixed(1)} unit="g" detail="Across today's meals" icon="⌁" tone="lavender" />
      <StatCard label="Carbohydrates" value={(nutrition?.total_carbs ?? 0).toFixed(1)} unit="g" detail="Across today's meals" icon="◒" tone="lime" />
      <StatCard label="Fats" value={(nutrition?.total_fats ?? 0).toFixed(1)} unit="g" detail="Across today's meals" icon="◉" tone="blue" />
    </section>
    <section className="panel form-panel">
      <div className="panel-heading"><div><p className="eyebrow muted">ADD WHAT YOU ATE</p><h2>Log a meal</h2></div></div>
      <form className="form-grid" onSubmit={addMeal}>
        <label>Meal type<select name="meal_type" defaultValue="Breakfast"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snacks</option></select></label>
        <label>Food name<input name="food_name" required maxLength={120} placeholder="e.g. Oatmeal with berries" /></label>
        <label>Calories (kcal)<input name="calories" type="number" min="0" max="10000" required defaultValue="0" /></label>
        <label>Protein (g)<input name="protein" type="number" min="0" max="1000" step="0.1" required defaultValue="0" /></label>
        <label>Carbohydrates (g)<input name="carbs" type="number" min="0" max="1000" step="0.1" required defaultValue="0" /></label>
        <label>Fats (g)<input name="fats" type="number" min="0" max="1000" step="0.1" required defaultValue="0" /></label>
        {actionError && <div className="form-error full-width">{actionError}</div>}
        <div className="form-actions full-width"><button className="button button-primary" disabled={busy}>{busy ? "Adding…" : "Add meal"} <span>→</span></button></div>
      </form>
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">TODAY'S INTAKE</p><h2>Meals <span className="title-count">{nutrition?.meals.length ?? 0}</span></h2></div></div>
      {error && <div className="form-error">{error}</div>}
      {loading ? <div className="empty-state">Loading your nutrition…</div> : nutrition?.meals.length ? <div className="meal-list">{nutrition.meals.map((meal) => <article className="meal-row" key={meal.id}><div className="meal-type-mark">{meal.meal_type.slice(0, 1)}</div><div className="meal-copy"><strong>{meal.food_name}</strong><span>{meal.meal_type} · {meal.protein}g protein · {meal.carbs}g carbs · {meal.fats}g fats</span></div><strong className="meal-calories">{meal.calories} <small>kcal</small></strong><button className="icon-button danger-hover" aria-label={`Delete ${meal.food_name}`} onClick={() => void removeMeal(meal)}>×</button></article>)}</div> : <div className="empty-state">No meals logged for today. Add your first meal above.</div>}
    </section>
  </div>;
}

function WaterPage() {
  const { user } = useAuth();
  const today = localDateString(new Date());
  const { data: water, loading, error, refresh } = useLoad(
    () => request<WaterSummary>(`/water?water_date=${today}`),
    [user?.id, today],
  );
  const [quantity, setQuantity] = useState("250");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const progress = Math.min(100, Math.round(((water?.consumed_ml ?? 0) / (water?.goal_ml ?? 2000)) * 100));

  async function logWater(amount = Number(quantity)) {
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter a water amount greater than zero.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await send("/water", "POST", { quantity: amount, date: today });
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not log water");
    } finally {
      setBusy(false);
    }
  }

  async function removeWater(id: number) {
    try {
      await send(`/water/${id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not remove water entry");
    }
  }

  return <div className="page-content">
    <PageHeader eyebrow="A LITTLE MORE WATER" title="Hydration" subtitle="Log your water throughout the day and work toward your personal goal." action={<Link className="button button-soft" to="/reminders">Set daily goal <span>→</span></Link>} />
    <section className="panel water-panel">
      <div className="panel-heading"><div><p className="eyebrow muted">TODAY'S PROGRESS</p><h2>{((water?.consumed_ml ?? 0) / 1000).toFixed(2)} <small>liters</small></h2></div><span className="water-percent">{progress}%</span></div>
      <div className="water-track" role="progressbar" aria-label="Daily water goal" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
      <div className="water-track-labels"><span>{(water?.consumed_ml ?? 0).toLocaleString()} ml consumed</span><span>{(water?.goal_ml ?? 2000).toLocaleString()} ml goal</span></div>
      <div className="water-actions"><button className="button button-soft" disabled={busy} onClick={() => void logWater(250)}>＋ 250 ml</button><button className="button button-soft" disabled={busy} onClick={() => void logWater(500)}>＋ 500 ml</button><form onSubmit={(event) => { event.preventDefault(); void logWater(); }}><input aria-label="Custom water amount in milliliters" type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><span>ml</span><button className="button button-primary" disabled={busy}>Log water</button></form></div>
      {actionError && <div className="form-error">{actionError}</div>}
      {error && <div className="form-error">{error}</div>}
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">WATER LOG</p><h2>Today's entries</h2></div></div>{loading ? <div className="empty-state">Loading your water log…</div> : water?.entries.length ? <div className="planned-list">{water.entries.map((entry) => <div className="water-entry" key={entry.id}><span className="water-drop">◌</span><strong>{entry.quantity} ml</strong><span>{formatDate(entry.date)}</span><button className="icon-button danger-hover" aria-label={`Delete ${entry.quantity} ml entry`} onClick={() => void removeWater(entry.id)}>×</button></div>)}</div> : <div className="empty-state">No water logged yet. Start with a glass.</div>}</section>
  </div>;
}

function RecommendationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: recommendations, loading, error } = useLoad(
    () => request<Recommendation[]>("/recommendations"),
    [user?.id],
  );
  return <div className="page-content">
    <PageHeader eyebrow="A SMARTER NEXT STEP" title="Recommended workouts" subtitle="Suggestions are based on your active goals and the kinds of workouts you've logged recently." />
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="panel empty-state">Finding a good fit…</div> : recommendations?.length ? <section className="recommendation-grid">{recommendations.map(({ exercise, reason }) => <article className="panel recommendation-card" key={exercise.id}><div className={`workout-type-icon ${categoryTone(exercise.category)}`}>{categoryIcon(exercise.category)}</div><span className="exercise-category">{exercise.category}</span><h2>{exercise.name}</h2><p>{exercise.description}</p><div className="recommendation-reason"><span>WHY THIS ONE</span>{reason}</div><div className="exercise-card-foot"><span>◷ {exercise.duration} min</span><button className="button button-soft" onClick={() => navigate("/plans", { state: { exerciseId: exercise.id } })}>Plan this <span>→</span></button></div></article>)}</section> : <div className="panel empty-state">No recommendations are available right now.</div>}
  </div>;
}

function WorkoutPlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: plans, loading, error, refresh } = useLoad(() => request<WorkoutPlan[]>("/workout-plans"), [user?.id]);
  const { data: exercises } = useLoad(() => request<Exercise[]>("/exercises"), [user?.id]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(localDateString(new Date()));
  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const routeState = location.state as { exerciseId?: number } | null;
    if (routeState?.exerciseId) {
      setSelectedExercises((current) => current.includes(routeState.exerciseId!) ? current : [...current, routeState.exerciseId!]);
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const plansOnDate = plans?.filter((plan) => plan.scheduled_date === selectedDate) ?? [];
  const upcoming = plans?.filter((plan) => plan.scheduled_date >= localDateString(new Date())).slice(0, 5) ?? [];

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await send("/workout-plans", "POST", {
        title: String(values.title),
        description: String(values.description ?? ""),
        scheduled_date: selectedDate,
        exercise_ids: selectedExercises,
      });
      setShowForm(false);
      setSelectedExercises([]);
      await refresh();
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : "Could not schedule workout");
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(plan: WorkoutPlan) {
    if (!window.confirm(`Remove "${plan.title}" from your planner?`)) return;
    try {
      await send(`/workout-plans/${plan.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : "Could not remove workout plan");
    }
  }

  const dayCells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  return <div className="page-content">
    <PageHeader eyebrow="PLAN AHEAD, FEEL READY" title="Workout planner" subtitle="Make room for movement in the week ahead." action={<button className="button button-primary" onClick={() => setShowForm((open) => !open)}><span>＋</span> Schedule workout</button>} />
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow muted">MAKE A PLAN</p><h2>Schedule for {formatDate(selectedDate)}</h2></div><button className="icon-button" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={createPlan} className="form-grid"><label>Workout title<input name="title" required minLength={2} maxLength={100} placeholder="e.g. Easy morning run" /></label><label>Description<input name="description" maxLength={500} placeholder="Add a note (optional)" /></label><div className="exercise-picker full-width"><span>Choose exercises</span><div className="exercise-picker-list">{exercises?.map((exercise) => <label key={exercise.id}><input type="checkbox" checked={selectedExercises.includes(exercise.id)} onChange={(event) => setSelectedExercises((selected) => event.target.checked ? [...selected, exercise.id] : selected.filter((id) => id !== exercise.id))} /><span>{exercise.name}<small>{exercise.category} · {exercise.duration} min</small></span></label>)}</div></div>{errorMessage && <div className="form-error full-width">{errorMessage}</div>}<div className="form-actions full-width"><button type="button" className="button button-soft" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save to planner"} <span>→</span></button></div></form></section>}
    {(error || errorMessage) && !showForm && <div className="form-error">{error || errorMessage}</div>}
    <section className="planner-grid">
      <article className="panel calendar-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">YOUR CALENDAR</p><h2>{monthLabel}</h2></div><div className="calendar-controls"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button className="icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
        <div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}{dayCells.map((day, index) => {
          if (!day) return <span className="calendar-empty" key={`empty-${index}`} />;
          const dateValue = localDateString(new Date(month.getFullYear(), month.getMonth(), day));
          const hasPlan = plans?.some((plan) => plan.scheduled_date === dateValue);
          return <button className={`calendar-day${selectedDate === dateValue ? " selected" : ""}${dateValue === localDateString(new Date()) ? " today" : ""}`} key={dateValue} onClick={() => setSelectedDate(dateValue)}><span>{day}</span>{hasPlan && <i />}</button>;
        })}</div>
        <div className="calendar-legend"><i /> Scheduled workout</div>
      </article>
      <article className="panel selected-day-panel">
        <div className="panel-heading"><div><p className="eyebrow muted">SCHEDULE</p><h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2></div><button className="button button-soft" onClick={() => setShowForm(true)}>＋ Add</button></div>
        {loading ? <div className="empty-state">Loading your planner…</div> : plansOnDate.length ? <div className="planned-list">{plansOnDate.map((plan) => <div className="planned-card" key={plan.id}><div className="planned-card-heading"><strong>{plan.title}</strong><button className="icon-button danger-hover" aria-label={`Delete ${plan.title}`} onClick={() => void removePlan(plan)}>×</button></div>{plan.description && <p>{plan.description}</p>}{plan.exercises.length > 0 && <div className="plan-exercises">{plan.exercises.map((exercise) => <span key={exercise.id}>{exercise.name}</span>)}</div>}</div>)}</div> : <div className="empty-state">Nothing planned for this day. Choose a date and create a plan.</div>}
      </article>
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">UP NEXT</p><h2>Upcoming workouts</h2></div><span className="title-count">{upcoming.length}</span></div>{upcoming.length ? <div className="planned-list">{upcoming.map((plan) => <button className="upcoming-row" key={plan.id} onClick={() => setSelectedDate(plan.scheduled_date)}><span className="planned-date">{new Date(`${plan.scheduled_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span><strong>{plan.title}</strong><span className="text-link">View →</span></button>)}</div> : <div className="empty-state">Your future sessions will appear here.</div>}</section>
  </div>;
}

function ExerciseLibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (category) query.set("category", category);
  const { data: exercises, loading, error } = useLoad(() => request<Exercise[]>(`/exercises${query.size ? `?${query}` : ""}`), [user?.id, search, category]);
  return <div className="page-content">
    <PageHeader eyebrow="FIND YOUR NEXT MOVE" title="Exercise library" subtitle="Explore simple ideas and add them to your workout plan." />
    <section className="panel exercise-filters"><label className="search-field"><span>⌕</span><input aria-label="Search exercises" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises…" /></label><label className="category-filter"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option><option>Cardio</option><option>Strength</option><option>Yoga</option></select></label></section>
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="panel empty-state">Finding exercises…</div> : exercises?.length ? <section className="exercise-grid">{exercises.map((exercise) => <article className="panel exercise-card" key={exercise.id}><div className={`workout-type-icon ${categoryTone(exercise.category)}`}>{categoryIcon(exercise.category)}</div><span className="exercise-category">{exercise.category}</span><h2>{exercise.name}</h2><p>{exercise.description}</p><div className="exercise-card-foot"><span>◷ {exercise.duration} min</span><button className="button button-soft" onClick={() => navigate("/plans", { state: { exerciseId: exercise.id } })}>Add to plan <span>→</span></button></div></article>)}</section> : <section className="panel empty-state">No exercises match these filters. Try another search.</section>}
  </div>;
}

function GoalsPage() {
  const { user } = useAuth();
  const { data: goals, loading, error, refresh } = useLoad(() => request<Goal[]>("/goals"), [user?.id]);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const input: GoalInput = {
      goal_type: values.goal_type as GoalInput["goal_type"],
      target_value: Number(values.target_value),
      current_value: Number(values.current_value),
      deadline: String(values.deadline),
    };
    try {
      await send("/goals", "POST", input);
      setShowForm(false);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not create goal");
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(goal: Goal) {
    const value = window.prompt(`Update progress for ${goal.goal_type} (target: ${goal.target_value})`, String(goal.current_value));
    if (value === null) return;
    const current_value = Number(value);
    if (!Number.isFinite(current_value) || current_value < 0) {
      setActionError("Progress must be a non-negative number.");
      return;
    }
    try {
      await send(`/goals/${goal.id}`, "PATCH", { current_value });
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not update goal");
    }
  }

  async function removeGoal(goal: Goal) {
    if (!window.confirm(`Remove your ${goal.goal_type.toLowerCase()} goal?`)) return;
    try {
      await send(`/goals/${goal.id}`, "DELETE");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not delete goal");
    }
  }

  return <div className="page-content">
    <PageHeader eyebrow="AIM WITH INTENTION" title="Goals that move you" subtitle="Set a direction, track the small wins, and adjust as you grow." action={<button className="button button-primary" onClick={() => setShowForm((shown) => !shown)}><span>＋</span> Set a goal</button>} />
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow muted">MAKE IT YOURS</p><h2>Set a new goal</h2></div><button className="icon-button" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={addGoal} className="form-grid"><label>Goal type<select name="goal_type"><option>Weight Loss</option><option>Muscle Gain</option><option>Steps</option></select></label><label>Target value<input name="target_value" type="number" min="0.01" step="any" required placeholder="e.g. 10" /></label><label>Current progress<input name="current_value" type="number" min="0" step="any" defaultValue="0" required /></label><label>Target date<input name="deadline" type="date" min={localDateString(new Date())} required /></label>{actionError && <div className="form-error full-width">{actionError}</div>}<div className="form-actions full-width"><button type="button" className="button button-soft" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Create goal"} <span>→</span></button></div></form></section>}
    {(error || actionError) && !showForm && <div className="form-error">{error || actionError}</div>}
    {loading ? <div className="panel empty-state">Loading your goals…</div> : goals?.length ? <div className="goal-grid">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdate={() => void updateProgress(goal)} onDelete={() => void removeGoal(goal)} />)}</div> : <section className="panel empty-state">You don't have a goal set yet. Choose something meaningful and make it your own.</section>}
  </div>;
}

function GoalCard({ goal, onUpdate, onDelete }: { goal: Goal; onUpdate: () => void; onDelete: () => void }) {
  const percent = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  return <article className="panel goal-card"><div className="goal-card-top"><div className="goal-symbol">{goal.goal_type === "Steps" ? "↗" : goal.goal_type === "Muscle Gain" ? "⌁" : "◎"}</div><span className={`status-pill ${goal.status}`}>{goal.status}</span><button className="icon-button goal-delete" title="Delete goal" onClick={onDelete}>×</button></div><p className="eyebrow muted">YOUR GOAL</p><h2>{goal.goal_type}</h2><div className="goal-progress-copy"><strong>{goal.current_value.toLocaleString()}</strong><span> / {goal.target_value.toLocaleString()}</span></div><div className="goal-track"><i style={{ width: `${percent}%` }} /></div><div className="goal-card-foot"><span>{percent}% complete</span><span>Due {formatDate(goal.deadline)}</span></div><button className="button button-soft goal-update" onClick={onUpdate}>{goal.status === "completed" ? "Update progress" : "Update progress"} <span>→</span></button></article>;
}

function ReportsPage() {
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [year, selectedMonth] = month.split("-").map(Number);
  const { data: report, loading, error } = useLoad(() => request<Report>(`/reports/monthly?year=${year}&month=${selectedMonth}`), [user?.id, year, selectedMonth]);
  const { data: weekly } = useLoad(() => request<Report>("/reports/weekly"), [user?.id]);
  const chartData = report?.days.map((day) => ({ ...day, label: new Date(`${day.date}T12:00:00`).getDate() })) ?? [];
  return <div className="page-content">
    <PageHeader eyebrow="ZOOM OUT, SEE THE CHANGE" title="Your progress, over time" subtitle="Patterns tell a story. Here's what yours is saying." action={<label className="month-picker"><span>MONTH</span><input aria-label="Select report month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />
    <section className="stats-grid report-stats"><StatCard label="This month" value={report?.total_workouts ?? 0} unit="workouts" detail="Sessions completed" icon="↗" tone="lime" /><StatCard label="Calories burned" value={(report?.total_calories ?? 0).toLocaleString()} unit="kcal" detail="Across your workouts" icon="✳" tone="peach" /><StatCard label="Time moving" value={formatHours(report?.total_duration ?? 0)} unit="" detail="Time invested in you" icon="◷" tone="blue" /><StatCard label="This week" value={weekly?.total_workouts ?? 0} unit="workouts" detail={`${(weekly?.total_calories ?? 0).toLocaleString()} kcal burned`} icon="✦" tone="lavender" /></section>
    {error && <div className="form-error">{error}</div>}
    <section className="panel report-chart-panel"><div className="panel-heading"><div><p className="eyebrow muted">DAILY BREAKDOWN</p><h2>Calories through the month</h2></div><span className="chart-legend"><i /> Calories</span></div><div className="report-chart">{loading ? <div className="empty-state">Loading your report…</div> : chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}><defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7e548" stopOpacity={0.38} /><stop offset="100%" stopColor="#b7e548" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} /><Tooltip labelFormatter={(label) => `${month}-${String(label).padStart(2, "0")}`} contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf" }} /><Area type="monotone" dataKey="total_calories" name="Calories" stroke="#88ae21" strokeWidth={2.5} fill="url(#reportFill)" /></AreaChart></ResponsiveContainer> : <div className="empty-state">No activity for this month yet. Start where you are.</div>}</div></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow muted">THE CURRENT WEEK</p><h2>Weekly snapshot</h2></div><span className="range-label">{weekly ? `${formatDate(weekly.start_date)} – ${formatDate(weekly.end_date)}` : ""}</span></div><div className="weekly-snapshot"><div><strong>{weekly?.total_workouts ?? 0}</strong><span>workouts completed</span></div><div><strong>{(weekly?.total_calories ?? 0).toLocaleString()}</strong><span>calories burned</span></div><div><strong>{formatHours(weekly?.total_duration ?? 0)}</strong><span>time in motion</span></div><div><strong>{weekly?.days.filter((day) => day.total_workouts).length ?? 0}<small> / 7</small></strong><span>active days</span></div></div></section>
  </div>;
}

function ComparisonPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const { data: comparison, loading, error } = useLoad(
    () => request<Comparison>(`/reports/comparison?period=${period}`),
    [user?.id, period],
  );
  const chartData = comparison?.current.days.map((day, index) => ({
    label: period === "weekly" ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : String(index + 1),
    current: day.total_workouts,
    previous: comparison.previous.days[index]?.total_workouts ?? 0,
  })) ?? [];
  const changeText = (change: number) => `${change > 0 ? "+" : ""}${change}`;
  return <div className="page-content">
    <PageHeader eyebrow="NOTICE YOUR PROGRESS" title="Progress comparison" subtitle="Compare your recent effort with the previous period." action={<div className="period-switch" role="group" aria-label="Comparison period"><button className={period === "weekly" ? "active" : ""} onClick={() => setPeriod("weekly")}>Weekly</button><button className={period === "monthly" ? "active" : ""} onClick={() => setPeriod("monthly")}>Monthly</button></div>} />
    {error && <div className="form-error">{error}</div>}
    <section className="stats-grid comparison-stats"><StatCard label="Workout change" value={changeText(comparison?.workout_change ?? 0)} unit="sessions" detail="Compared with the previous period" icon="↗" tone="lime" /><StatCard label="Calorie change" value={changeText(comparison?.calorie_change ?? 0).toLocaleString()} unit="kcal" detail="Energy burned" icon="✳" tone="peach" /><StatCard label="Time change" value={changeText(comparison?.duration_change ?? 0)} unit="minutes" detail="Time spent moving" icon="◷" tone="blue" /><StatCard label="This period" value={comparison?.current.total_workouts ?? 0} unit="workouts" detail={comparison ? `${comparison.previous.total_workouts} in the previous period` : "Compared with your last period"} icon="✦" tone="lavender" /></section>
    <section className="panel report-chart-panel"><div className="panel-heading"><div><p className="eyebrow muted">WORKOUT FREQUENCY</p><h2>Current vs previous {period === "weekly" ? "week" : "month"}</h2></div><span className="chart-legend"><i /> Sessions</span></div><div className="report-chart">{loading ? <div className="empty-state">Comparing your progress…</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf" }} /><Legend /><Bar dataKey="previous" name="Previous" fill="#dfe5d4" radius={[4, 4, 0, 0]} /><Bar dataKey="current" name="Current" fill="#a5ce49" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}</div></section>
    {comparison && <section className="panel comparison-insight"><span className="focus-icon">✦</span><div><p className="eyebrow muted">A SMALL INSIGHT</p><h2>{comparison.workout_change > 0 ? "You're building momentum." : comparison.workout_change < 0 ? "Every week is a fresh start." : "You're keeping a steady rhythm."}</h2><p>{comparison.workout_change > 0 ? `You logged ${comparison.workout_change} more workout${comparison.workout_change === 1 ? "" : "s"} than the previous ${period === "weekly" ? "week" : "month"}.` : comparison.workout_change < 0 ? `You logged ${Math.abs(comparison.workout_change)} fewer workout${Math.abs(comparison.workout_change) === 1 ? "" : "s"} this period. Pick one small session to get back into your rhythm.` : "You logged the same number of workouts as the previous period. Consistency counts."}</p></div></section>}
  </div>;
}

function AnalyticsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const { data, loading, error } = useLoad(
    () => request<Analytics>(`/analytics?period=${period}`),
    [user?.id, period],
  );
  const chartData = data?.report.days.map((day) => ({
    ...day,
    label: period === "weekly"
      ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })
      : new Date(`${day.date}T12:00:00`).getDate(),
  })) ?? [];
  return <div className="page-content">
    <PageHeader eyebrow="MORE THAN A SINGLE WORKOUT" title="Performance insights" subtitle="See your consistency, goal progress, and training trends at a glance." action={<div className="period-switch" role="group" aria-label="Analytics period"><button className={period === "weekly" ? "active" : ""} onClick={() => setPeriod("weekly")}>Weekly</button><button className={period === "monthly" ? "active" : ""} onClick={() => setPeriod("monthly")}>Monthly</button></div>} />
    {error && <div className="form-error">{error}</div>}
    <section className="stats-grid report-stats">
      <StatCard label="Workouts" value={data?.report.total_workouts ?? 0} unit="sessions" detail={`This ${period === "weekly" ? "week" : "month"}`} icon="↗" tone="lime" />
      <StatCard label="Workout consistency" value={data?.consistency_rate ?? 0} unit="%" detail={`${data?.active_days ?? 0} active days`} icon="✦" tone="peach" />
      <StatCard label="Goal completion" value={data?.goal_completion_rate ?? 0} unit="%" detail={`${data?.goals_completed ?? 0} of ${data?.goals_total ?? 0} goals completed`} icon="◎" tone="blue" />
      <StatCard label="Time moving" value={formatHours(data?.report.total_duration ?? 0)} unit="" detail={`${(data?.report.total_calories ?? 0).toLocaleString()} kcal burned`} icon="◷" tone="lavender" />
    </section>
    <section className="panel report-chart-panel"><div className="panel-heading"><div><p className="eyebrow muted">{period === "weekly" ? "THIS WEEK" : "THIS MONTH"}</p><h2>Daily workout and calorie trends</h2></div></div><div className="report-chart">{loading ? <div className="empty-state">Building your insights…</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 10 }} /><YAxis yAxisId="workouts" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 10 }} /><YAxis yAxisId="calories" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#92988d", fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e8ebdf" }} /><Legend /><Bar yAxisId="workouts" dataKey="total_workouts" name="Workouts" fill="#a5ce49" radius={[4, 4, 0, 0]} /><Bar yAxisId="calories" dataKey="total_calories" name="Calories burned" fill="#e7b28e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}</div></section>
    <section className="panel comparison-insight"><span className="focus-icon">✦</span><div><p className="eyebrow muted">YOUR CONSISTENCY</p><h2>{data?.active_days ? `${data.active_days} active day${data.active_days === 1 ? "" : "s"} so far` : "Your next active day starts whenever you do."}</h2><p>{data?.goals_total ? `You have completed ${data.goals_completed} of ${data.goals_total} fitness goals.` : "Set a fitness goal to add goal completion insights to this dashboard."}</p></div></section>
  </div>;
}

function RemindersPage() {
  const { user } = useAuth();
  const { data: settings, loading, error, refresh } = useLoad(
    () => request<UserSettings>("/settings"),
    [user?.id],
  );
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveReminders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    setNotice("");
    const values = new FormData(event.currentTarget);
    const enabled = (name: string) => values.get(name) === "on";
    try {
      await send("/settings", "PUT", {
        water_goal_ml: Number(values.get("water_goal_ml")),
        workout_reminder_enabled: enabled("workout_reminder_enabled"),
        workout_reminder_time: String(values.get("workout_reminder_time")),
        meal_reminder_enabled: enabled("meal_reminder_enabled"),
        meal_reminder_time: String(values.get("meal_reminder_time")),
        water_reminder_enabled: enabled("water_reminder_enabled"),
        water_reminder_time: String(values.get("water_reminder_time")),
      });
      window.dispatchEvent(new Event("fittrack-settings-updated"));
      if ("Notification" in window && window.Notification.permission === "default") {
        await window.Notification.requestPermission();
      }
      setNotice("Your reminder preferences have been saved.");
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not save reminder preferences");
    } finally {
      setBusy(false);
    }
  }

  return <div className="page-content">
    <PageHeader eyebrow="MAKE GOOD HABITS EASIER" title="Reminders & daily goals" subtitle="Choose gentle reminders for workouts, meals, and water. Set a personal hydration target too." />
    {error && <div className="form-error">{error}</div>}
    {loading || !settings ? <div className="panel empty-state">Loading your preferences…</div> : <form key={settings.user_id} className="panel reminder-form" onSubmit={saveReminders}>
      <div className="panel-heading"><div><p className="eyebrow muted">YOUR PREFERENCES</p><h2>Daily routine</h2></div></div>
      <label className="water-goal-setting">Daily water goal (ml)<input name="water_goal_ml" type="number" min="250" max="10000" step="250" required defaultValue={settings.water_goal_ml} /></label>
      <div className="reminder-settings">
        <ReminderSetting title="Workout reminder" description="A nudge to make time for movement." enabledName="workout_reminder_enabled" timeName="workout_reminder_time" enabled={settings.workout_reminder_enabled} time={settings.workout_reminder_time} />
        <ReminderSetting title="Meal reminder" description="Remember to pause for your meals." enabledName="meal_reminder_enabled" timeName="meal_reminder_time" enabled={settings.meal_reminder_enabled} time={settings.meal_reminder_time} />
        <ReminderSetting title="Water reminder" description="A friendly hydration check-in." enabledName="water_reminder_enabled" timeName="water_reminder_time" enabled={settings.water_reminder_enabled} time={settings.water_reminder_time} />
      </div>
      <p className="reminder-note">Reminders are checked while FitTrack is open. Browser notifications also require permission; reminders remain in your FitTrack inbox.</p>
      {actionError && <div className="form-error">{actionError}</div>}
      {notice && <div className="success-message" role="status">{notice}</div>}
      <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"} <span>→</span></button></div>
    </form>}
  </div>;
}

function ReminderSetting({ title, description, enabledName, timeName, enabled, time }: { title: string; description: string; enabledName: string; timeName: string; enabled: boolean; time: string }) {
  return <div className="reminder-setting"><div><strong>{title}</strong><span>{description}</span></div><label className="reminder-toggle"><input type="checkbox" name={enabledName} defaultChecked={enabled} /><span>Enabled</span></label><label className="reminder-time">Time<input type="time" name={timeName} defaultValue={time} required /></label></div>;
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, loading, error, refresh, setData } = useLoad(() => request<Notification[]>("/notifications"), [user?.id]);
  const unread = notifications?.filter((item) => !item.is_read).length ?? 0;

  async function markAllRead() {
    try {
      await send("/notifications/read-all", "PATCH");
      setData((notifications ?? []).map((item) => ({ ...item, is_read: true })));
      window.dispatchEvent(new Event("fittrack-notifications-updated"));
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Could not update notifications");
    }
  }
  async function markRead(item: Notification) {
    if (item.is_read) return;
    try {
      await send(`/notifications/${item.id}/read`, "PATCH");
      setData((notifications ?? []).map((notification) => notification.id === item.id ? { ...notification, is_read: true } : notification));
      window.dispatchEvent(new Event("fittrack-notifications-updated"));
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Could not update notification");
    }
  }

  return <div className="page-content"><PageHeader eyebrow="A GENTLE NUDGE, WHEN YOU NEED IT" title="Your notifications" subtitle="A little encouragement for the journey you're on." action={!!unread && <button className="button button-soft" onClick={() => void markAllRead()}>Mark all read</button>} />{error && <div className="form-error">{error}</div>}<section className="panel notification-panel"><div className="panel-heading"><div><p className="eyebrow muted">YOUR INBOX</p><h2>Recent updates <span className="title-count">{notifications?.length ?? 0}</span></h2></div><button className="icon-button" title="Refresh notifications" onClick={() => void refresh()}>↻</button></div>{loading ? <div className="empty-state">Checking for updates…</div> : notifications?.length ? <div className="notification-list">{notifications.map((item) => <button className={`notification-item ${item.is_read ? "read" : ""}`} key={item.id} onClick={() => void markRead(item)}><span className="notification-mark">{item.title.includes("Goal") || item.title.includes("goal") ? "◎" : "✳"}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}</small></span>{!item.is_read && <span className="unread-dot" />}</button>)}</div> : <div className="empty-state">All caught up. We'll leave a little encouragement here when you need it.</div>}</section></div>;
}

export default App;
