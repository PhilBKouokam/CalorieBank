import FoodLog from "../models/FoodLog.js";
import { normalizeLogDate } from "../utils/normalizeLogDate.js";

// Calculate Daily Bank Balance (TDEE + extra burn - intake)
const calculateDailyBank = (log, tdee = 2000) => {
    const totalIntake = log.entries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
    const totalBurn = tdee + (log.burnedCalories || 0);

    return Math.round(totalBurn - totalIntake);
};

const getWeekStart = (date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
};

const getDateKey = (dateValue = null) => {
    if (typeof dateValue === "string") {
        const dateOnlyMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) return dateValue;
    }

    const date = normalizeLogDate(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getDayIdentity = (dateValue) => {
    const logDate = getDateKey(dateValue);
    const start = normalizeLogDate(logDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const utcStart = new Date(`${logDate}T00:00:00.000Z`);
    const utcEnd = new Date(utcStart);
    utcEnd.setUTCDate(utcStart.getUTCDate() + 1);

    return { logDate, start, end, utcStart, utcEnd };
};

const buildDailyLogQuery = (userId, day) => ({
    user: userId,
    $or: [
        { logDate: day.logDate },
        { date: { $gte: day.start, $lt: day.end } },
        { date: { $gte: day.utcStart, $lt: day.utcEnd } }
    ]
});

const dedupeById = (items = []) => {
    const seen = new Set();

    return items.filter((item) => {
        const id = item._id?.toString();
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const calculateBurnedCalories = (activities = []) => (
    activities.reduce((sum, activity) => sum + (activity.calories || 0), 0)
);

const syncLogTotals = (log, tdee) => {
    log.burnedCalories = calculateBurnedCalories(log.burnedActivities || []);
    log.bankBalance = calculateDailyBank(log, tdee);
};

const mergeDailyLogs = async ({ userId, date, tdee, createIfMissing = false }) => {
    const day = getDayIdentity(date);
    const logs = await FoodLog.find(buildDailyLogQuery(userId, day)).sort({ createdAt: 1 });

    if (logs.length === 0) {
        if (!createIfMissing) return null;

        const log = new FoodLog({
            user: userId,
            date: day.start,
            logDate: day.logDate,
            entries: [],
            burnedCalories: 0,
            burnedActivities: [],
            bankBalance: 0
        });
        await log.save();
        return log;
    }

    const primary = logs.find((log) => log.date?.getTime() === day.start.getTime())
        || logs.find((log) => (log.entries || []).length > 0)
        || logs.find((log) => (log.burnedActivities || []).length > 0 || (log.burnedCalories || 0) > 0)
        || logs[0];
    const duplicates = logs.filter((log) => !log._id.equals(primary._id));

    primary.entries = dedupeById(logs.flatMap((log) => log.entries || []));
    primary.burnedActivities = dedupeById(logs.flatMap((log) => log.burnedActivities || []));
    primary.date = day.start;
    primary.logDate = day.logDate;
    syncLogTotals(primary, tdee);

    await primary.save();

    if (duplicates.length > 0) {
        await FoodLog.deleteMany({
            _id: { $in: duplicates.map((log) => log._id) }
        });
    }

    return primary;
};

export const getWeeklyBank = async (req, res) => {
    try {
        const today = normalizeLogDate();
        const weekStart = getWeekStart(today);
        let bankBalance = 0;
        const history = [];
        const logs = [];

        for (const day = new Date(weekStart); day <= today; day.setDate(day.getDate() + 1)) {
            const log = await mergeDailyLogs({
                userId: req.user.userId,
                date: getDateKey(day),
                tdee: req.user.tdee,
                createIfMissing: false
            });
            const emptyLog = {
                _id: day.toISOString(),
                date: new Date(day),
                logDate: getDateKey(day),
                entries: [],
                burnedCalories: 0
            };
            const logForDay = log || emptyLog;
            const dayBank = log ? log.bankBalance : 0;
            const consumedCalories = logForDay.entries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
            bankBalance += dayBank;

            if (log) logs.push(log);

            history.push({
                _id: logForDay._id,
                date: logForDay.date,
                logDate: logForDay.logDate || getDateKey(logForDay.date),
                consumedCalories,
                burnedCalories: logForDay.burnedCalories || 0,
                bankBalance: Math.round(dayBank)
            });
        }

        res.json({
            bankBalance: Math.round(bankBalance),
            weekStart,
            throughDate: today,
            logs,
            history
        });
    } catch (err) {
        console.error("Get Weekly Bank Error:", err);
        res.status(500).json({ message: "Failed to load weekly bank" });
    }
};

// Get or Create Daily Log
export const getDailyLog = async (req, res) => {
    try {
        const { date } = req.query;
        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: true
        });

        // Auto-update totals
        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch (err) {
        console.error("Get Daily Log Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

//Add Food Entry
export const addFoodEntry = async (req, res) => {
    try {
        const { foodName, calories, protein = 0, carbs = 0, fats = 0, photoUrl } = req.body;
        const { date } = req.query || {};

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: true
        });

        log.entries.push({
            foodName: foodName.trim(),
            calories: Number(calories),
            protein: Number(protein),
            carbs: Number(carbs),
            fats: Number(fats),
            photoUrl: photoUrl || null
        });

        syncLogTotals(log, req.user.tdee);
        await log.save();

        //  Get the ID of the newly added entry
        const newEntryId = log.entries[log.entries.length - 1]._id;

        res.status(201).json({
            log,
            entryId: newEntryId
        });
    } catch (error) {
        console.error("Add Food Entry Error:", error);
        res.status(500).json({ message: "Failed to add food entry" });
    }
};

export const updateFoodEntry = async (req, res) => {
    try {
        const { entryId } = req.params;
        const { foodName, calories, protein, carbs, fats, photoUrl } = req.body;
        const { date } = req.query || {};

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: false
        });
        const entry = log?.entries.id(entryId);

        if (!log || !entry) {
            return res.status(404).json({ message: "Entry not found" });
        }

        entry.foodName = foodName.trim();
        entry.calories = Number(calories);
        entry.protein = Number(protein);
        entry.carbs = Number(carbs);
        entry.fats = Number(fats);
        entry.photoUrl = photoUrl ?? null;

        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Update Food Entry Error:", error);
        res.status(500).json({ message: "Failed to update entry" });
    }
};

export const deleteFoodEntry = async (req, res) => {
    try {
        const { entryId } = req.params;
        const { date } = req.query || {};

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: false
        });
        const entry = log?.entries.id(entryId);

        if (!log || !entry) {
            return res.status(404).json({ message: "Entry not found" });
        }

        entry.deleteOne();
        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Delete Food Entry Error:", error);
        res.status(500).json({ message: "Failed to delete entry" });
    };
};

export const logBurnedCalories = async (req, res) => {
    try {
        const { amount, activityType = "Activity" } = req.body;
        const { date } = req.query || {};
        const calories = Number(amount);

        if (!Number.isFinite(calories) || calories <= 0) {
            return res.status(400).json({ message: "A valid calorie amount is required" });
        }

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: true
        });

        log.burnedActivities.push({
            activityType: activityType.trim() || "Activity",
            calories
        });

        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Add Burned Calories Error:", error);
        res.status(500).json({ message: "Failed to log burned calories" });
    }
};

export const updateBurnedActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { amount, activityType = "Activity" } = req.body;
        const { date } = req.query || {};
        const calories = Number(amount);

        if (!Number.isFinite(calories) || calories <= 0) {
            return res.status(400).json({ message: "A valid calorie amount is required" });
        }

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: false
        });
        const activity = log?.burnedActivities.id(activityId);

        if (!log || !activity) {
            return res.status(404).json({ message: "Burned activity not found" });
        }

        activity.activityType = activityType.trim() || "Activity";
        activity.calories = calories;
        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Update Burned Activity Error:", error);
        res.status(500).json({ message: "Failed to update burned activity" });
    }
};

export const deleteBurnedActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { date } = req.query || {};

        const log = await mergeDailyLogs({
            userId: req.user.userId,
            date,
            tdee: req.user.tdee,
            createIfMissing: false
        });
        const activity = log?.burnedActivities.id(activityId);

        if (!log || !activity) {
            return res.status(404).json({ message: "Burned activity not found" });
        }

        log.burnedActivities.pull(activityId);
        syncLogTotals(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Delete Burned Activity Error:", error);
        res.status(500).json({ message: "Failed to delete burned activity" });
    }
};
