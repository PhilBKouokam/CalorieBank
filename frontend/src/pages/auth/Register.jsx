import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { apiFetch } from "../../utils/api.js";

const mealOptions = [
    "Ice cream",
    "Cookies",
    "Pizza",
    "Burgers",
    "Fries",
    "Tacos",
    "Pasta",
    "Chocolate",
    "Donuts",
    "Fast food"
];

const activityOptions = [
    "Walking",
    "Cycling",
    "Weightlifting",
    "Swimming",
    "Running",
    "Bowling",
    "Mini golf",
    "Basketball",
    "Dancing",
    "Hiking"
];

export default function Register() {
    const [registerData, setRegisterData] = useState({
        username: "",
        email: "",
        password: "",
        favoriteMeals: [],
        favoriteActivities: [],
        height: "",
        weight: "",
        age: "",
        sex: "male",
        activityLevel: "moderate",
        dailyCalorieIntake: "2000"
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setRegisterData({
            ...registerData,
            [e.target.name]: e.target.value
        });
    };

    const handleMultiSelect = (field, value) => {
        const currentValues = registerData[field];
        const nextValues = currentValues.includes(value)
            ? currentValues.filter((item) => item !== value)
            : [...currentValues, value];

        setRegisterData({
            ...registerData,
            [field]: nextValues
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const requestBody = {
                username: registerData.username,
                email: registerData.email,
                password: registerData.password,
                favoriteMeals: registerData.favoriteMeals,
                favoriteActivities: registerData.favoriteActivities,
                height: Number(registerData.height),
                weight: Number(registerData.weight),
                age: Number(registerData.age),
                sex: registerData.sex,
                activityLevel: registerData.activityLevel,
                dailyCalorieIntake: Number(registerData.dailyCalorieIntake)
            };

            const res = await apiFetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Registration failed");
            }

            login(data.token, data.user);
            navigate("/");
        } catch(err) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12">
            <div className="w-full max-w-lg">
                <div className="card p-8 shadow-xl">
                    <h2 className="text-3xl font-bold text-center mb-2">Create Account</h2>
                    <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
                        Bank calories to enjoy your favorite treats guilt free
                    </p>

                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg mb-6 text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Username</label>
                            <input
                                type="text"
                                name="username"
                                value={registerData.username}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                placeholder="johndoe"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={registerData.email}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                placeholder="you@example.com"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={registerData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Favorite Meals & Treats</label>
                            <div className="grid grid-cols-2 gap-2">
                                {mealOptions.map((meal) => (
                                    <label key={meal} className="flex items-center gap-2 text-sm px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900">
                                        <input
                                            type="checkbox"
                                            checked={registerData.favoriteMeals.includes(meal)}
                                            onChange={() => handleMultiSelect("favoriteMeals", meal)}
                                            disabled={loading}
                                            className="accent-emerald-600"
                                        />
                                        {meal}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Favorite Activities</label>
                            <div className="grid grid-cols-2 gap-2">
                                {activityOptions.map((activity) => (
                                    <label key={activity} className="flex items-center gap-2 text-sm px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-900">
                                        <input
                                            type="checkbox"
                                            checked={registerData.favoriteActivities.includes(activity)}
                                            onChange={() => handleMultiSelect("favoriteActivities", activity)}
                                            disabled={loading}
                                            className="accent-emerald-600"
                                        />
                                        {activity}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* TDEE Profile Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Height (cm)</label>
                                <input
                                    type="number"
                                    name="height"
                                    value={registerData.height}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                    placeholder="175"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                                <input
                                    type="number"
                                    name="weight"
                                    value={registerData.weight}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                    placeholder="70"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Age</label>
                                <input
                                    type="number"
                                    name="age"
                                    value={registerData.age}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                    placeholder="25"
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Sex</label>
                                <select
                                    name="sex"
                                    value={registerData.sex}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                    disabled={loading}
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Daily Calorie Intake</label>
                            <input
                                type="number"
                                name="dailyCalorieIntake"
                                value={registerData.dailyCalorieIntake}
                                onChange={handleChange}
                                required
                                min="1000"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                placeholder="2000"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Activity Level</label>
                            <select
                                name="activityLevel"
                                value={registerData.activityLevel}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900"
                                disabled={loading}
                            >
                                <option value="sedentary">Sedentary (little exercise)</option>
                                <option value="light">Light (1-3 days/week)</option>
                                <option value="moderate">Moderate (3-5 days/week)</option>
                                <option value="active">Active (6-7 days/week)</option>
                                <option value="very_active">Very Active (athlete level)</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70"
                        >
                            {loading? "Creating Account..." : "Create Account"}
                        </button>
                    </form>

                    <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
                        Already have an account?{" "}
                        <Link to="/login" className="text-emerald-600 hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};
