import { useContext, useEffect, useMemo, useState } from "react";
import { Gift, Landmark, Timer, Utensils } from "lucide-react";
import { AuthContext } from "../context/AuthContext.jsx";
import { FoodLogContext } from "../context/FoodLogContext.jsx";

const activityMetValues = {
    Walking: 3.5,
    Cycling: 7.5,
    Weightlifting: 4.5,
    Swimming: 6,
    Running: 9.8,
    Bowling: 3,
    "Mini golf": 3,
    Basketball: 6.5,
    Dancing: 5,
    Hiking: 6,
    Yoga: 3,
    Pilates: 3.5
};

const defaultTreatPlan = {
    favoriteTreat: "",
    favoriteTreatCalories: "",
    nextTreat: "",
    nextTreatCalories: ""
};

const getDateKey = (day) => {
    if (!day) return "";
    if (typeof day === "object" && day.logDate) return day.logDate;
    if (typeof day === "string") return day.split("T")[0];
    return new Date(day).toISOString().split("T")[0];
};

const getTodayDateKey = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const dateNumber = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${dateNumber}`;
};

const formatDate = (day) => {
    const dateKey = getDateKey(day);
    const [year, month, dateNumber] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, dateNumber);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const calculateDayBank = (log, tdee = 2000) => {
    const consumedCalories = (log.entries || []).reduce((sum, entry) => sum + (entry.calories || 0), 0);
    const burnedCalories = log.burnedCalories || 0;
    const isToday = getDateKey(log) === getTodayDateKey();

    return {
        consumedCalories,
        burnedCalories,
        bankBalance: isToday ? 0 : Math.round((Number(tdee) || 2000) + burnedCalories - consumedCalories)
    };
};

const normalizeWeeklyHistory = (weeklyBank, user) => {
    if (weeklyBank?.history?.length) {
        return weeklyBank.history;
    }

    return (weeklyBank?.logs || []).map((log) => ({
        _id: log._id,
        date: log.date,
        logDate: log.logDate,
        ...calculateDayBank(log, user?.tdee)
    }));
};

const getStoredTreatPlan = () => {
    try {
        return JSON.parse(localStorage.getItem("joyTreatPlan")) || defaultTreatPlan;
    } catch {
        return defaultTreatPlan;
    }
};

const defaultActivityOptions = ["Walking", "Cycling", "Weightlifting", "Running"];

export default function JoyBankingCenter() {
    const { user } = useContext(AuthContext);
    const { weeklyBank, loading, error, fetchWeeklyBank } = useContext(FoodLogContext);
    const [treatPlan, setTreatPlan] = useState(getStoredTreatPlan());
    const [selectedActivity, setSelectedActivity] = useState("");

    useEffect(() => {
        fetchWeeklyBank();
    }, [fetchWeeklyBank]);

    useEffect(() => {
        localStorage.setItem("joyTreatPlan", JSON.stringify(treatPlan));
    }, [treatPlan]);

    const activityOptions = user?.favoriteActivities?.length
        ? user.favoriteActivities
        : defaultActivityOptions;
    const activityForEstimate = selectedActivity || activityOptions[0] || "Cycling";
    const activityMet = activityMetValues[activityForEstimate] || 5;
    const userWeight = Number(user?.weight) || 70;
    const caloriesPerHour = Math.round(activityMet * 3.5 * userWeight / 200 * 60);
    const weeklyHistory = useMemo(() => normalizeWeeklyHistory(weeklyBank, user), [weeklyBank, user]);
    const derivedBankedCalories = weeklyHistory.reduce((sum, day) => sum + (day.bankBalance || 0), 0);
    const bankedCalories = weeklyHistory.length > 0 ? derivedBankedCalories : (weeklyBank?.bankBalance || 0);
    const targetCalories = Number(treatPlan.favoriteTreatCalories) || 0;
    const remainingCalories = Math.max(targetCalories - bankedCalories, 0);
    const progress = targetCalories > 0
        ? Math.min(Math.max((bankedCalories / targetCalories) * 100, 0), 100)
        : 0;
    const minutesNeeded = caloriesPerHour > 0
        ? Math.ceil((remainingCalories / caloriesPerHour) * 60)
        : 0;
    const thirtyMinuteSessions = minutesNeeded > 0 ? Math.ceil(minutesNeeded / 30) : 0;

    const weeklyTotals = useMemo(() => {
        return weeklyHistory.reduce((totals, day) => ({
            consumed: totals.consumed + (day.consumedCalories || 0),
            burned: totals.burned + (day.burnedCalories || 0)
        }), { consumed: 0, burned: 0 });
    }, [weeklyHistory]);

    const handleTreatChange = (e) => {
        setTreatPlan({
            ...treatPlan,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Joy Banking Center</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Track your weekly bank and plan the treats you are saving room for.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="card p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <Landmark size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold">Weekly Banking History</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {loading ? "Loading..." : `${bankedCalories} calories banked this week`}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 mb-5 sm:grid-cols-3">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Consumed</p>
                            <p className="text-2xl font-semibold">{weeklyTotals.consumed}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Extra Burn</p>
                            <p className="text-2xl font-semibold">{weeklyTotals.burned}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Banked</p>
                            <p className="text-2xl font-semibold">{bankedCalories}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {weeklyHistory.map((day) => (
                            <div key={day._id || day.logDate || day.date} className="grid gap-1 text-sm bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-3 sm:items-center">
                                <span className="font-medium">{formatDate(day)}</span>
                                <span className="text-gray-500 dark:text-gray-400">{day.consumedCalories} eaten</span>
                                <span className="text-gray-500 dark:text-gray-400">{day.burnedCalories} burned</span>
                                <span className={day.bankBalance >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                                    {day.bankBalance >= 0 ? "+" : ""}{day.bankBalance}
                                </span>
                            </div>
                        ))}

                        {!loading && weeklyHistory.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                No banking history yet this week.
                            </div>
                        )}
                    </div>
                </section>

                <section className="card p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <Gift size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold">Treat Goal</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Plan your next guilt-free bite.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Favorite treat</label>
                            <input
                                type="text"
                                name="favoriteTreat"
                                value={treatPlan.favoriteTreat}
                                onChange={handleTreatChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                placeholder="Ice cream"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Calories</label>
                            <input
                                type="number"
                                name="favoriteTreatCalories"
                                value={treatPlan.favoriteTreatCalories}
                                onChange={handleTreatChange}
                                min="1"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                placeholder="1000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Next treat</label>
                            <input
                                type="text"
                                name="nextTreat"
                                value={treatPlan.nextTreat}
                                onChange={handleTreatChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                placeholder="Pizza night"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Next treat calories</label>
                            <input
                                type="number"
                                name="nextTreatCalories"
                                value={treatPlan.nextTreatCalories}
                                onChange={handleTreatChange}
                                min="1"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                placeholder="750"
                            />
                        </div>
                    </div>
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Utensils size={20} />
                        </div>
                        <h2 className="font-semibold">Treat Progress</h2>
                    </div>

                    <div className="mb-3 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Goal</p>
                            <p className="break-words text-xl font-semibold sm:text-2xl">{treatPlan.favoriteTreat || "Choose a treat"}</p>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(progress)}%</p>
                    </div>

                    <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        {targetCalories > 0
                            ? `${bankedCalories} of ${targetCalories} calories banked. ${remainingCalories === 0 ? "You're there." : `${remainingCalories} calories to go.`}`
                            : "Enter a treat and calories to start tracking progress."}
                    </p>
                </section>

                <section className="card p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <Timer size={20} />
                        </div>
                        <h2 className="font-semibold">Burn Plan</h2>
                    </div>

                    <label className="block text-sm font-medium mb-1">Activity to estimate</label>
                    <select
                        value={activityForEstimate}
                        onChange={(e) => setSelectedActivity(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                    >
                        {activityOptions.map((activity) => (
                            <option key={activity} value={activity}>
                                {activity}
                            </option>
                        ))}
                    </select>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Burn</p>
                            <p className="text-2xl font-semibold">{caloriesPerHour}/hr</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                            <p className="text-2xl font-semibold">{remainingCalories}</p>
                        </div>
                    </div>

                    <p className="mt-5 text-gray-600 dark:text-gray-400">
                        {targetCalories > 0 && remainingCalories > 0
                            ? `About ${minutesNeeded} minutes of ${activityForEstimate}, or ${thirtyMinuteSessions} focused 30-minute session${thirtyMinuteSessions === 1 ? "" : "s"}, would cover the remaining calories.`
                            : targetCalories > 0
                                ? "Your current bank already covers this treat."
                                : "Add your treat calories to see an activity estimate."}
                    </p>
                </section>
            </div>
        </div>
    );
}
