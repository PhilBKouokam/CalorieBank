import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";

export default function AddEntryButton({ date }) {
    const target = date ? `/add-entry?date=${date}` : "/add-entry";

    return (
        <Link
            to={target}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
            <PlusCircle size={20} />
            Add Entry
        </Link>
    );
};
