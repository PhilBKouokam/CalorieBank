import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws.js";
import FoodLog from "../models/FoodLog.js";
import { normalizeLogDate } from "../utils/normalizeLogDate.js";

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
        const targetDate = normalizeLogDate(date);

        const log = await FoodLog.findOneAndUpdate(
            {
                user: req.user.userId,
                date: targetDate,
                "entries._id": entryId
            },
            { $set: { "entries.$.photoUrl": photoUrl } },
            { new: true }
        );

        if (!log) {
            return res.status(404).json({ message: "Food entry not found" });
        }

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
