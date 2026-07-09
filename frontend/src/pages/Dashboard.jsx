import { useContext, useEffect, useState } from "react";
import { FoodLogContext } from "../context/FoodLogContext.jsx";
import { AuthContext } from "../context/AuthContext.jsx";

// Components
import DailyBank from "../components/Bank/DailyBank.jsx";
import FoodLogList from "../components/FoodLog/FoodLogList.jsx";
import AddEntryButton from "../components/FoodLog/AddEntryButton.jsx";
import MacroSummary from "../components/Dashboard/MacroSummary.jsx"
import BurnedCaloriesLogger from "../components/Dashboard/BurnedCaloriesLogger.jsx";

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

export default function Dashboard() {
    const { currentLog, weeklyBank, loading, error, fetchDailyLog, fetchWeeklyBank } = useContext(FoodLogContext);
    const { user } = useContext(AuthContext);
    const [selectedDate, setSelectedDate] = useState(getTodayDateString());

    useEffect(() => {
        fetchDailyLog(selectedDate);
    }, [fetchDailyLog, selectedDate]);

    useEffect(() => {
        fetchWeeklyBank();
    }, [fetchWeeklyBank]);

    if (loading && !currentLog) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="spinner-border text-emerald-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your daily log...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Welcome Header */}
            <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Good morning, {user?.username} 👋</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Here's your progress for today
                </p>
            </div>

            {/* Bank Balance Section */}
            <DailyBank log={currentLog} user={user} weeklyBank={weeklyBank} />

            {/* Macro Summary */}
            <MacroSummary log={currentLog} />

            <BurnedCaloriesLogger log={currentLog} date={selectedDate} />

            {/* Today's Food Entries */}
            <div className="card p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold sm:text-2xl">Food Entries</h2>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mt-3 mb-1">
                            View Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:[color-scheme:dark] sm:w-auto"
                        />
                    </div>
                    <AddEntryButton date={selectedDate} />
                </div>

                <FoodLogList log={currentLog} date={selectedDate} />

                {error && (
                    <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
