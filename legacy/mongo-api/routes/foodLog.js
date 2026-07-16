import express from "express";
import {
    getDailyLog,
    getWeeklyBank,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    logBurnedCalories,
    updateBurnedActivity,
    deleteBurnedActivity,
} from "../controllers/foodLogController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/weekly-bank", getWeeklyBank);
router.get("/", getDailyLog);
router.post("/entry/", addFoodEntry);
router.patch("/entry/:entryId", updateFoodEntry);
router.delete("/entry/:entryId", deleteFoodEntry);
router.post("/burned", logBurnedCalories);
router.patch("/burned/:activityId", updateBurnedActivity);
router.delete("/burned/:activityId", deleteBurnedActivity);

export default router;
