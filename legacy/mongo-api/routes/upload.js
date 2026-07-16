import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { uploadFoodPhoto } from "../controllers/uploadController.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.post(
    "/food-photo/:entryId",
    protect,
    upload.single("photo"),
    uploadFoodPhoto
);

export default router;