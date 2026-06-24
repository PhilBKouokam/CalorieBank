import { useContext, useState } from "react";
import { Trash2, Edit } from "lucide-react";
import { FoodLogContext } from "../../context/FoodLogContext.jsx";

export default function FoodLogList({ log, date }) {
    const { deleteFoodEntry, updateFoodEntry, uploadFoodPhoto } = useContext(FoodLogContext);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editPhotoFile, setEditPhotoFile] = useState(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState("");

    const startEditing = (entry) => {
        setEditingId(entry._id);
        setEditForm({
            foodName: entry.foodName,
            calories: entry.calories,
            protein: entry.protein || "",
            carbs: entry.carbs || "",
            fats: entry.fats || "",
            photoUrl: entry.photoUrl || null
        });
        setEditPhotoFile(null);
        setEditPhotoPreview(entry.photoUrl || "");
    };

    const handleEditChange = (e) => {
        setEditForm({
            ...editForm,
            [e.target.name]: e.target.value
        });
    };

    const handleEditPhotoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setEditPhotoFile(file);
        setEditPhotoPreview(file ? URL.createObjectURL(file) : editForm.photoUrl || "");
    };

    const removeEditPhoto = () => {
        setEditPhotoFile(null);
        setEditPhotoPreview("");
        setEditForm({
            ...editForm,
            photoUrl: null
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;

        const logDate = date || log.date;
        const result = await updateFoodEntry(editingId, editForm, logDate);
        if (result.success) {
            if (editPhotoFile) {
                await uploadFoodPhoto(editingId, editPhotoFile, logDate);
            }
            setEditingId(null);
            setEditForm({});
            setEditPhotoFile(null);
            setEditPhotoPreview("");
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
        setEditPhotoFile(null);
        setEditPhotoPreview("");
    };

    if (!log || (log.entries || []).length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No entries yet. Add your first meal!
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {(log.entries || []).map((entry) => (
                <div key={entry._id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    {editingId === entry._id ? (
                        // Edit Mode
                        <div className="space-y-3">
                            {editPhotoPreview && (
                                <div className="flex flex-col items-center gap-2">
                                    <img
                                        src={editPhotoPreview}
                                        alt={`${editForm.foodName || "Food"} photo`}
                                        className="h-32 w-32 rounded-xl object-cover"
                                        onError={() => setEditPhotoPreview("")}
                                    />
                                    <button
                                        type="button"
                                        className="text-sm text-red-600 hover:text-red-700 transition-colors"
                                        onClick={removeEditPhoto}
                                    >
                                        Remove photo
                                    </button>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1">Food Name</label>
                                <input
                                    type="text"
                                    name="foodName"
                                    value={editForm.foodName}
                                    onChange={handleEditChange}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Food name"
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Calories</label>
                                    <input
                                        type="number"
                                        name="calories"
                                        value={editForm.calories}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="Cal"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Protein (g)</label>
                                    <input
                                        type="number"
                                        name="protein"
                                        value={editForm.protein}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="P"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Carbs (g)</label>
                                    <input
                                        type="number"
                                        name="carbs"
                                        value={editForm.carbs}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="C"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Fats (g)</label>
                                    <input
                                        type="number"
                                        name="fats"
                                        value={editForm.fats}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="F"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Food Photo</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleEditPhotoChange}
                                    className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    onClick={cancelEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                                    onClick={saveEdit}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Normal View
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {entry.photoUrl && (
                                    <img
                                        src={entry.photoUrl}
                                        alt={`${entry.foodName} photo`}
                                        className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                )}
                                <div className="min-w-0">
                                    <div className="font-medium">{entry.foodName}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {entry.calories} cal • {entry.protein}p • {entry.carbs}c • {entry.fats}f 
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                    onClick={() => startEditing(entry)}
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    onClick={async () => {
                                        if (window.confirm("Delete this entry?")) {
                                            await deleteFoodEntry(entry._id, date || log.date);
                                        }
                                    }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
