import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import foodLogRoutes from "./routes/foodLog.js";
import uploadRoutes from "./routes/upload.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true
}));

app.use("/api/upload", uploadRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get("/", (req, res) => {
    res.send("CalorieBank API is running...");
});

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");

        app.use("/api/foodlog", foodLogRoutes);
        app.use("/api/auth", authRoutes);

        const PORT = process.env.PORT || 4700;
        app.listen(PORT, () => {
            console.log(`🚀 CalorieBank Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Server Error:", error.message);
        process.exit(1);
    }
};

startServer();
