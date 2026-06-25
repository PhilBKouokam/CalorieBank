import { useContext, useState } from "react";
import { Activity, Edit, Plus, Trash2 } from "lucide-react";
import { FoodLogContext } from "../../context/FoodLogContext.jsx";

const activityOptions = [
    "🚶 Walking",
    "🏃 Running",
    "🏋️ Weightlifting",
    "🚴 Cycling",
    "🏊 Swimming",
    "🥾 Hiking",
    "🧘 Yoga",
    "🤸 Pilates",
    "⚽ Sports",
    "💃 Dancing",
    "🧹 Housework",
    "Other"
];

export default function BurnedCaloriesLogger({ log, date }) {
    const { logBurnedCalories, updateBurnedActivity, deleteBurnedActivity } = useContext(FoodLogContext);
    const [isOpen, setIsOpen] = useState(false);
    const [activityType, setActivityType] = useState(activityOptions[0]);
    const [customActivityType, setCustomActivityType] = useState("");
    const [amount, setAmount] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ activityType: "", amount: "" });
    const [loading, setLoading] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [error, setError] = useState("");

    const activities = log?.burnedActivities || [];

    const resetForm = () => {
        setActivityType(activityOptions[0]);
        setCustomActivityType("");
        setAmount("");
        setError("");
    };

    const handleCancel = () => {
        resetForm();
        setIsOpen(false);
    };

    const startEditing = (activity) => {
        setEditingId(activity._id);
        setEditForm({
            activityType: activity.activityType || "Activity",
            amount: activity.calories || ""
        });
        setError("");
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({ activityType: "", amount: "" });
        setError("");
    };

    const saveEdit = async () => {
        if (!editingId) return;

        setError("");
        setEditLoading(true);

        try {
            const result = await updateBurnedActivity(
                editingId,
                editForm.amount,
                editForm.activityType || "Activity",
                date
            );

            if (!result.success) {
                throw new Error("Failed to update burned calories");
            }

            cancelEditing();
        } catch (err) {
            setError(err.message || "Failed to update burned calories");
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (activityId) => {
        if (!window.confirm("Delete this burned calorie entry?")) return;

        setError("");
        const result = await deleteBurnedActivity(activityId, date);

        if (!result.success) {
            setError("Failed to delete burned calories");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const selectedActivity = activityType === "Other"
                ? customActivityType.trim()
                : activityType;

            const result = await logBurnedCalories(amount, selectedActivity || "Activity", date);

            if (!result.success) {
                throw new Error("Failed to log burned calories");
            }

            resetForm();
            setIsOpen(false);
        } catch (err) {
            setError(err.message || "Failed to log burned calories");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold">Extra Calories Burned</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {log?.burnedCalories || 0} calories logged today
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    <Plus size={18} />
                    Add Burn
                </button>
            </div>

            {isOpen && (
                <form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                    <select
                        name="activityType"
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                        disabled={loading}
                    >
                        {activityOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        name="amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        min="1"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                        placeholder="Calories"
                        disabled={loading}
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                            className="px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-70"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-70 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                        >
                            {loading ? "Saving" : "Log"}
                        </button>
                    </div>
                    {activityType === "Other" && (
                        <input
                            type="text"
                            name="customActivityType"
                            value={customActivityType}
                            onChange={(e) => setCustomActivityType(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 sm:col-span-3"
                            placeholder="Custom activity"
                            disabled={loading}
                        />
                    )}
                </form>
            )}

            {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            {activities.length > 0 && (
                <div className="mt-5 space-y-2">
                    {activities.slice().reverse().map((activity) => (
                        <div key={activity._id || activity.addedAt} className="text-sm bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                            {editingId === activity._id ? (
                                <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                                    <input
                                        type="text"
                                        name="activityType"
                                        value={editForm.activityType}
                                        onChange={(e) => setEditForm({ ...editForm, activityType: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                        placeholder="Activity"
                                        disabled={editLoading}
                                    />
                                    <input
                                        type="number"
                                        name="amount"
                                        value={editForm.amount}
                                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                        required
                                        min="1"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                        placeholder="Calories"
                                        disabled={editLoading}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={cancelEditing}
                                            disabled={editLoading}
                                            className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-70"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveEdit}
                                            disabled={editLoading}
                                            className="px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-70"
                                        >
                                            {editLoading ? "Saving" : "Save"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <span className="font-medium">{activity.activityType}</span>
                                        <span className="ml-3 text-gray-500 dark:text-gray-400">{activity.calories} cal</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                            onClick={() => startEditing(activity)}
                                            aria-label={`Edit ${activity.activityType}`}
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                            onClick={() => handleDelete(activity._id)}
                                            aria-label={`Delete ${activity.activityType}`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
