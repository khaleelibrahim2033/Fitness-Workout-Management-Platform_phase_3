from datetime import date as Date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class WorkoutCategory(str, Enum):
    cardio = "Cardio"
    strength = "Strength"
    yoga = "Yoga"


class GoalType(str, Enum):
    weight_loss = "Weight Loss"
    muscle_gain = "Muscle Gain"
    steps = "Steps"


class MealType(str, Enum):
    breakfast = "Breakfast"
    lunch = "Lunch"
    dinner = "Dinner"
    snacks = "Snacks"


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WorkoutCreate(BaseModel):
    workout_name: str = Field(min_length=2, max_length=100)
    category: WorkoutCategory
    duration: int = Field(gt=0, le=1440)
    calories_burned: int = Field(ge=0, le=10000)
    workout_date: Date


class WorkoutUpdate(BaseModel):
    workout_name: str | None = Field(default=None, min_length=2, max_length=100)
    category: WorkoutCategory | None = None
    duration: int | None = Field(default=None, gt=0, le=1440)
    calories_burned: int | None = Field(default=None, ge=0, le=10000)
    workout_date: Date | None = None


class WorkoutResponse(WorkoutCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime


class ProgressDay(BaseModel):
    date: Date
    total_workouts: int
    total_calories: int
    total_duration: int


class GoalCreate(BaseModel):
    goal_type: GoalType
    target_value: float = Field(gt=0, le=1_000_000_000)
    current_value: float = Field(default=0, ge=0, le=1_000_000_000)
    deadline: Date


class GoalUpdate(BaseModel):
    current_value: float = Field(ge=0, le=1_000_000_000)


class GoalResponse(GoalCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    status: str


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime


class ReportSummary(BaseModel):
    start_date: Date
    end_date: Date
    total_workouts: int
    total_calories: int
    total_duration: int
    days: list[ProgressDay]


class ExerciseCategory(str, Enum):
    cardio = "Cardio"
    strength = "Strength"
    yoga = "Yoga"


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: ExerciseCategory
    description: str
    duration: int


class WorkoutPlanCreate(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=500)
    scheduled_date: Date
    exercise_ids: list[int] = Field(default_factory=list, max_length=30)


class WorkoutPlanResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: str
    scheduled_date: Date
    created_at: datetime
    exercises: list[ExerciseResponse]


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_workout_date: Date | None


class BadgeResponse(BaseModel):
    id: int
    name: str
    description: str
    icon: str
    earned_at: datetime | None


class ComparisonResponse(BaseModel):
    period: str
    current: ReportSummary
    previous: ReportSummary
    workout_change: int
    calorie_change: int
    duration_change: int


class DashboardResponse(BaseModel):
    today: ReportSummary
    upcoming_workouts: list[WorkoutPlanResponse]
    goals: list[GoalResponse]
    streak: StreakResponse
    badges: list[BadgeResponse]


class MealCreate(BaseModel):
    meal_type: MealType
    food_name: str = Field(min_length=1, max_length=120)
    calories: int = Field(ge=0, le=10000)
    protein: float = Field(ge=0, le=1000)
    carbs: float = Field(ge=0, le=1000)
    fats: float = Field(ge=0, le=1000)

    @field_validator("food_name")
    @classmethod
    def food_name_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Food name cannot be blank")
        return value


class MealResponse(MealCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime


class NutritionSummary(BaseModel):
    date: Date
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fats: float
    meals: list[MealResponse]


class WaterCreate(BaseModel):
    quantity: int = Field(gt=0, le=10000)
    date: Date = Field(default_factory=Date.today)


class WaterResponse(WaterCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int


class WaterSummary(BaseModel):
    date: Date
    consumed_ml: int
    goal_ml: int
    entries: list[WaterResponse]


class UserSettingsUpdate(BaseModel):
    water_goal_ml: int = Field(ge=250, le=10000)
    workout_reminder_enabled: bool
    workout_reminder_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    meal_reminder_enabled: bool
    meal_reminder_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    water_reminder_enabled: bool
    water_reminder_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class UserSettingsResponse(UserSettingsUpdate):
    model_config = ConfigDict(from_attributes=True)

    user_id: int


class RecommendationResponse(BaseModel):
    exercise: ExerciseResponse
    reason: str


class AnalyticsResponse(BaseModel):
    period: str
    report: ReportSummary
    active_days: int
    consistency_rate: float
    goals_completed: int
    goals_total: int
    goal_completion_rate: float


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=500)

    @field_validator("title", "message")
    @classmethod
    def notification_text_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Notification text cannot be blank")
        return value
