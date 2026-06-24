import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AuthContext } from "./AuthContext";
import { apiFetch } from "../utils/api.js";

export const FoodLogContext = createContext();

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

export const FoodLogProvider = ({ children }) => {
    const { token } = useContext(AuthContext);

    const [currentLog, setCurrentLog] = useState(null);
    const [weeklyBank, setWeeklyBank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchDailyLog = useCallback(async (date = getTodayDateString()) => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const query = `?date=${date}`;
            const res = await apiFetch(`/api/foodlog${query}`);

            if (res.ok) {
                const data = await res.json();
                setCurrentLog(data);
            } else {
                setError("Failed to load daily log");
            }
        } catch (err) {
            console.error(err);
            setError("Network error");
        } finally {
            setLoading(false);
        };
    }, [token]);

    const fetchWeeklyBank = useCallback(async () => {
        if (!token) return;

        try {
            const res = await apiFetch("/api/foodlog/weekly-bank");

            if (res.ok) {
                const data = await res.json();
                setWeeklyBank(data);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.message || "Failed to load calorie bank");
            }
        } catch (err) {
            console.error(err);
            setError("Network error");
        }
    }, [token]);

    // Load today's log when token changes
    useEffect(() => {
        if (token) {
            fetchDailyLog();
            fetchWeeklyBank();
        } else {
            setCurrentLog(null);
            setWeeklyBank(null);
            setLoading(false);
        }
    }, [token, fetchDailyLog, fetchWeeklyBank]);

    const addFoodEntry = async (entryData, date = getTodayDateString()) => {
        try {
            const query = `?date=${date}`;
            const res = await apiFetch(`/api/foodlog/entry${query}`, {
                method: "POST",
                body: JSON.stringify(entryData)
            });

            if (!res.ok) return { success: false };

            const { log, entryId } = await res.json();
            setCurrentLog(log);
            fetchWeeklyBank();
            return { success: true, log, entryId };
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    const updateFoodEntry = async (entryId, updatedData, date = null) => {
        try {
            const query = date ? `?date=${date}` : "";
            const res = await apiFetch(`/api/foodlog/entry/${entryId}${query}`, {
                method: "PATCH",
                body: JSON.stringify(updatedData)
            });

            if (res.ok) {
                const updatedLog = await res.json();
                setCurrentLog(updatedLog);
                fetchWeeklyBank();
                return { success: true, log: updatedLog }
            }
            return { success: false };
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    const deleteFoodEntry = async (entryId, date = null) => {
        try {
            const query = date ? `?date=${date}` : "";
            const res = await apiFetch(`/api/foodlog/entry/${entryId}${query}`, {
                method: "DELETE"
            });

            if (res.ok) {
                const updatedLog = await res.json();
                setCurrentLog(updatedLog);
                fetchWeeklyBank();
                return { success: true, log: updatedLog };
            }
            return { success: false };
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    const logBurnedCalories = async (amount, activityType, date = getTodayDateString()) => {
        try {
            const query = `?date=${date}`;
            const res = await apiFetch(`/api/foodlog/burned${query}`, {
                method: "POST",
                body: JSON.stringify({ amount, activityType })
            });

            if (res.ok) {
                const updatedLog = await res.json();
                setCurrentLog(updatedLog);
                fetchWeeklyBank();
                return { success: true, log: updatedLog };
            }
            return { success: false };
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    // Upload Photo for specific entry
    const uploadFoodPhoto = async (entryId, file, date = getTodayDateString()) => {
        try {
            const formData = new FormData();
            formData.append("photo", file);

            const query = `?date=${date}`;
            const res = await apiFetch(`/api/upload/food-photo/${entryId}${query}`, {
                method: "POST",
                body: formData,
                headers: {}
            });

            if (!res.ok) return { success: false };

            const { log, photoUrl } = await res.json();
            setCurrentLog(log);
            return { success: true, photoUrl };
        } catch (err) {
            console.error(err);
            return { success: false }
        }
    };

    return (
        <FoodLogContext.Provider value={{ 
            currentLog,
            weeklyBank,
            loading,
            error,
            fetchDailyLog,
            fetchWeeklyBank,
            addFoodEntry,
            updateFoodEntry,
            deleteFoodEntry,
            logBurnedCalories,
            uploadFoodPhoto
         }}>
            {children}
         </FoodLogContext.Provider>
    );
};
