import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Harris-Benedict + activity multiplier
const calculateTDEE = ({ weight, height, age, sex, activityLevel }) => {
    if (!weight || !height || !age || !sex) return 2000;

    let bmr;
    if (sex === "male") {
        bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
        bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }

    const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    };

    return Math.round(bmr * (multipliers[activityLevel] || 1.55));
};

const generateToken = (user) => {
    const dailyCalorieIntake = user.dailyCalorieIntake || 2000;
    const tdee = user.tdee || 2000;

    return jwt.sign(
        {
            userId: user._id,
            username: user.username,
            tdee,
            dailyCalorieIntake
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

export const register = async (req, res) => {
    try {
        const body = req.body?.registerData || req.body?.formData || req.body || {};
        const {
            username,
            email,
            password,
            height,
            weight,
            age,
            sex,
            activityLevel = "moderate",
            dailyCalorieIntake = 2000,
            favoriteMeals = [],
            favoriteActivities = []
        } = body;

        const profile = {
            height: Number(height),
            weight: Number(weight),
            age: Number(age),
            sex,
            activityLevel
        };

        const missingFields = [];
        if (!username?.trim()) missingFields.push("username");
        if (!email?.trim()) missingFields.push("email");
        if (!password) missingFields.push("password");
        if (!Number.isFinite(profile.height) || profile.height <= 0) missingFields.push("height");
        if (!Number.isFinite(profile.weight) || profile.weight <= 0) missingFields.push("weight");
        if (!Number.isFinite(profile.age) || profile.age <= 0) missingFields.push("age");
        if (!sex) missingFields.push("sex");
        if (!activityLevel) missingFields.push("activityLevel");

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(", ")}`,
                missingFields
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const tdee = calculateTDEE(profile);

        const user = new User({ 
            username: username.trim(), 
            email: email.trim(), 
            password: hashedPassword,
            favoriteMeals,
            favoriteActivities,
            ...profile,
            dailyCalorieIntake: Number(dailyCalorieIntake) || 2000,
            tdee
        });

        await user.save();

        const token = generateToken(user);
        const dailyCalorieIntakeValue = user.dailyCalorieIntake || 2000;
        const tdeeValue = user.tdee || 2000;

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                favoriteMeals: user.favoriteMeals,
                favoriteActivities: user.favoriteActivities,
                height: user.height,
                weight: user.weight,
                age: user.age,
                sex: user.sex,
                activityLevel: user.activityLevel,
                dailyCalorieIntake: dailyCalorieIntakeValue,
                tdee: tdeeValue
            }
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = generateToken(user);
        const dailyCalorieIntakeValue = user.dailyCalorieIntake || 2000;
        const tdeeValue = user.tdee || 2000;

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                favoriteMeals: user.favoriteMeals,
                favoriteActivities: user.favoriteActivities,
                height: user.height,
                weight: user.weight,
                age: user.age,
                sex: user.sex,
                activityLevel: user.activityLevel,
                dailyCalorieIntake: dailyCalorieIntakeValue,
                tdee: tdeeValue
            }
        });
    } catch(error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
};
