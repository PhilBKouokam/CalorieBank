import { useState, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FoodLogContext } from "../context/FoodLogContext.jsx";

function AddEntry() {
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        foodName: "",
        calories: "",
        protein: "",
        carbs: "",
        fats: ""
    });

    const [photoFile, setPhotoFile] = useState(null);
    const [date, setDate] = useState(searchParams.get("date") || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { addFoodEntry, uploadFoodPhoto } = useContext(FoodLogContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePhotoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setPhotoFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const selectedDate = date || undefined;

            // Step 1: Add the food entry
            const result = await addFoodEntry(formData, selectedDate);

            if (!result.success) {
                throw new Error("Failed to add entry");
            }

            // Step 2: If user selected a photo, upload it
            if (photoFile && result.entryId) {
                await uploadFoodPhoto(result.entryId, photoFile, selectedDate);
            }

            navigate("/");
        } catch(err) {
            setError(err.message || "Failed to save entry");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="card p-8">
                <h1 className="text-3xl font-bold mb-2">Add New Entry</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Log your meal or snack
                </p>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Food Name</label>
                        <input
                            type="text"
                            name="foodName"
                            value={formData.foodName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Grilled Chicken Breast"
                            disabled={loading}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Calories</label>
                            <input
                                type="number"
                                name="calories"
                                value={formData.calories}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="350"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Date (optional)</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Protein (g)</label>
                            <input
                                type="number"
                                name="protein"
                                value={formData.protein}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="30"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Carbs (g)</label>
                            <input
                                type="number"
                                name="carbs"
                                value={formData.carbs}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="10"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Fats (g)</label>
                            <input
                                type="number"
                                name="fats"
                                value={formData.fats}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="15"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Food Photo (Optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 rounded-2xl transition-colors disabled:opacity-70"
                    >
                        {loading ? "Saving Entry..." : "Add Entry"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AddEntry;
