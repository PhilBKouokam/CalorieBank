import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },

    favoriteMeals: [{
        type: String,
        trim: true
    }],

    favoriteActivities: [{
        type: String,
        trim: true
    }],

    // TDEE Profile
    height: { type: Number },   //cm
    weight: { type: Number },   //kg
    sex: { type: String, enum: ["male", "female"] },
    age: { type: Number },
    activityLevel: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active", "very_active"],
        default: "moderate"
    },

    dailyCalorieIntake: {
        type: Number,
        default: 2000,
        min: 1000
    },

    tdee: {
        type: Number,
        default: 2000,
        min: 1000
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("User", userSchema);
