# FitTrack

A full-stack fitness and workout management app. The API is built with FastAPI, SQLAlchemy, and SQLite; the responsive React/TypeScript client is built with Vite.

## Features

- Email/password registration and login with bcrypt password hashes and expiring JWTs
- Owner-scoped workout CRUD and automatically maintained daily progress summaries
- Fitness goals with progress tracking, completion/overdue status, and goal notifications
- Daily activity dashboard, weekly report, monthly report, and calorie charts
- Per-user notifications, daily workout reminders, and read/unread controls
- Workout planning with an exercise library, searchable exercises, and calendar scheduling
- Weekly and monthly progress comparisons, daily streaks, and milestone badges
- Personalized dashboard with daily activity, upcoming plans, goals, streak, and achievements
- Daily meal and macronutrient tracking with calorie summaries
- Water intake logging with a configurable daily hydration goal
- Goal- and history-informed exercise recommendations
- Live workout timer that saves a session and estimates calories when stopped
- Weekly and monthly performance analytics with consistency and goal completion rates
- Per-user workout, meal, and hydration reminders, including notification inbox alerts
- Input validation, production JWT-secret guard, and configurable CORS/database settings

Google Fit and Apple Health synchronization are optional integrations and are not enabled in this phase; they require platform-specific authorization and account configuration.

## Run locally

### API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`. Swagger groups endpoints into Authentication, Workouts, Workout Plans, Exercises, Progress, Reports, Goals, Achievements, Dashboard, Nutrition, Hydration, Recommendations, Analytics, Settings, Notifications, and System sections. In production, set `APP_ENV=production` and provide a strong, unique `JWT_SECRET_KEY`. The development secret is not suitable for deployment.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app is available at `http://localhost:5173`. During development, `/api` requests are proxied to `http://127.0.0.1:8000`. To point it at another API origin, define `VITE_API_URL` (for example, `http://localhost:8000/api`) before starting Vite. Set `FRONTEND_ORIGIN` on the API to the frontend origin; multiple comma-separated origins are supported.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/workouts`, `PATCH|DELETE /api/workouts/{id}`
- `GET /api/exercises?search=...&category=Cardio|Strength|Yoga`
- `GET|POST /api/workout-plans`, `DELETE /api/workout-plans/{id}`
- `GET /api/streak`, `GET /api/badges`, `GET /api/dashboard`
- `GET /api/progress`, `GET /api/reports/weekly`, `GET /api/reports/monthly`
- `GET /api/reports/comparison?period=weekly|monthly`
- `GET|POST /api/goals`, `PATCH|DELETE /api/goals/{id}`
- `GET|POST /api/notifications`, `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`
- `GET|POST /api/meals`, `DELETE /api/meals/{id}` (daily totals via `GET /api/meals?meal_date=YYYY-MM-DD`)
- `GET|POST /api/water`, `DELETE /api/water/{id}` (daily totals and goal via `GET /api/water?water_date=YYYY-MM-DD`)
- `GET|PUT /api/settings` (water goal and reminder preferences)
- `GET /api/recommendations` (history- and goal-informed exercise suggestions)
- `GET /api/analytics?period=weekly|monthly`

All user-specific routes require a bearer token. Records are always queried and changed within the authenticated user's ownership scope. Browser reminders are evaluated while FitTrack is open; optional browser notifications require permission.
