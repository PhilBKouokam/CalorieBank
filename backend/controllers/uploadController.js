import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws.js";
import FoodLog from "../models/FoodLog.js";
import { normalizeLogDate } from "../utils/normalizeLogDate.js";

const getDateKey = (dateValue = null) => {
    if (typeof dateValue === "string") {
        const dateOnlyMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) return dateValue;
    }

    const dateForKey = normalizeLogDate(dateValue);
    const year = dateForKey.getFullYear();
    const month = String(dateForKey.getMonth() + 1).padStart(2, "0");
    const day = String(dateForKey.getDate()).padStart(2, "0");

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

export const uploadFoodPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const { entryId } = req.params; // entryId = index in entries
        const { date } = req.query || req.body;

        if (!entryId) {
            return res.status(400).json({ message: "entryId is required" });
        }
        const file = req.file;

        // Generate unique filename
        const fileName = `food-photos/${req.user.userId}-${Date.now()}-${file.originalname}`;

        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const photoUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        //Update the specific food entry
        const day = getDayIdentity(date);

        const log = await FoodLog.findOne(
            {
                user: req.user.userId,
                $or: [
                    { logDate: day.logDate },
                    { date: { $gte: day.start, $lt: day.end } },
                    { date: { $gte: day.utcStart, $lt: day.utcEnd } }
                ],
                "entries._id": entryId
            }
        );

        if (!log) {
            return res.status(404).json({ message: "Food entry not found" });
        }

        const entry = log.entries.id(entryId);
        entry.photoUrl = photoUrl;
        log.date = day.start;
        log.logDate = day.logDate;
        await log.save();

        res.json({
            message: "Photo uploaded successfully",
            photoUrl,
            log
        });
    } catch(error) {
        console.error("Upload Food Photo Error:", error);
        res.status(500).json({ message: "Failed to upload photo" });
    }
};
