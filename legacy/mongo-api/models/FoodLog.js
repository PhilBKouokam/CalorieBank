import mongoose from "mongoose";

const foodLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    logDate: {
        type: String,
        trim: true
    },
    entries: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId() // Auto-generates _id for each entry
        },
        foodName: {
            type: String,
            required: true,
            trim: true
        },
        calories: {
            type: Number,
            required: true,
            min: 0
        },
        protein: {
            type: Number,
            default: 0
        },
        carbs: {
            type: Number,
            default: 0
        }, 
        fats: {
            type: Number,
            default: 0
        },
        photoUrl: {
            type: String,
            default: null
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    burnedCalories: {
        type: Number,
        default: 0
    },
    burnedActivities: [{
        activityType: {
            type: String,
            required: true,
            trim: true
        },
        calories: {
            type: Number,
            required: true,
            min: 0
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    bankBalance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

foodLogSchema.index({ user: 1, date: 1 });
foodLogSchema.index({ user: 1, logDate: 1 }, { unique: true, sparse: true });

export default mongoose.model("FoodLog", foodLogSchema);
