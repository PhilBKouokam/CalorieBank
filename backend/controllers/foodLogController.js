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

export const getWeeklyBank = async (req, res) => {
    try {
        const today = normalizeLogDate();
        const weekStart = getWeekStart(today);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const logs = await FoodLog.find({
            user: req.user.userId,
            date: {
                $gte: weekStart,
                $lt: tomorrow
            }
        }).sort({ date: 1 });

        const logsByDate = new Map(
            logs.map((log) => [normalizeLogDate(log.date).toISOString(), log])
        );
        let bankBalance = 0;
        const history = [];

        for (const day = new Date(weekStart); day <= today; day.setDate(day.getDate() + 1)) {
            const log = logsByDate.get(day.toISOString());
            const emptyLog = {
                _id: day.toISOString(),
                date: new Date(day),
                entries: [],
                burnedCalories: 0
            };
            const logForDay = log || emptyLog;
            const dayBank = log ? calculateDailyBank(log, req.user.tdee) : 0;
            const consumedCalories = logForDay.entries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
            bankBalance += dayBank;

            history.push({
                _id: logForDay._id,
                date: logForDay.date,
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
        const targetDate = normalizeLogDate(date);

        let log = await FoodLog.findOne({
            user: req.user.userId,
            date: targetDate
        });

        if (!log) {
            log = new FoodLog({
                user: req.user.userId,
                date: targetDate,
                entries: [],
                burnedCalories: 0,
                bankBalance: 0
            });
            await log.save();
        }

        // Auto-update bank balance
        log.bankBalance = calculateDailyBank(log, req.user.tdee);
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

        const targetDate = normalizeLogDate(date);

        let log = await FoodLog.findOneAndUpdate(
            { user: req.user.userId, date: targetDate },
            {
                $push: {
                    entries: {
                        foodName: foodName.trim(),
                        calories: Number(calories),
                        protein: Number(protein),
                        carbs: Number(carbs),
                        fats: Number(fats),
                        photoUrl: photoUrl || null
                    }
                }
            },
            { new: true, upsert: true }
        );

        log.bankBalance = calculateDailyBank(log, req.user.tdee);
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

        const targetDate = normalizeLogDate(date);

        const log = await FoodLog.findOneAndUpdate(
            {
                user: req.user.userId,
                date: targetDate,
                "entries._id": entryId
            },
            {
                $set: {
                    "entries.$.foodName": foodName.trim(),
                    "entries.$.calories": Number(calories),
                    "entries.$.protein": Number(protein),
                    "entries.$.carbs": Number(carbs),
                    "entries.$.fats": Number(fats),
                    "entries.$.photoUrl": photoUrl ?? null
                }
            }, 
            { new: true }
        );

        if (!log) {
            return res.status(404).json({ message: "Entry not found" });
        }

        log.bankBalance = calculateDailyBank(log, req.user.tdee);
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

        const targetDate = normalizeLogDate(date);

        const log = await FoodLog.findOneAndUpdate(
            { user: req.user.userId, date: targetDate },
            { $pull: { entries: { _id: entryId } } },
            { new: true }
        );

        if (!log) {
            return res.status(404).json({ message: "Entry not found" });
        }

        log.bankBalance = calculateDailyBank(log, req.user.tdee);
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
        const targetDate = normalizeLogDate(date);
        const calories = Number(amount);

        if (!Number.isFinite(calories) || calories <= 0) {
            return res.status(400).json({ message: "A valid calorie amount is required" });
        }

        const log = await FoodLog.findOneAndUpdate(
            { user: req.user.userId, date: targetDate },
            {
                $inc: { burnedCalories: calories },
                $push: {
                    burnedActivities: {
                        activityType: activityType.trim() || "Activity",
                        calories
                    }
                }
            },
            { new: true, upsert: true }
        );

        log.bankBalance = calculateDailyBank(log, req.user.tdee);
        await log.save();

        res.json(log);
    } catch(error) {
        console.error("Add Burned Calories Error:", error);
        res.status(500).json({ message: "Failed to log burned calories" });
    }
};
