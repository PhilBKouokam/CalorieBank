export default function MacroSummary({ log }) {
    if (!log) return null;

    const formatMacro = (value) => Number(value).toFixed(2).replace(/\.?0+$/, "");

    const totalProtein = log.entries.reduce((sum, e) => sum + (e.protein || 0), 0);
    const totalCarbs = log.entries.reduce((sum, e) => sum + (e.carbs || 0), 0);
    const totalFats = log.entries.reduce((sum, e) => sum + (e.fats || 0), 0);

    return (
        <div className="card p-4 sm:p-6">
            <h3 className="font-semibold mb-4">Today's Macros</h3>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 sm:text-3xl">{formatMacro(totalProtein)}g</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">PROTEIN</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600 sm:text-3xl">{formatMacro(totalCarbs)}g</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">CARBS</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 sm:text-3xl">{formatMacro(totalFats)}g</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">FATS</div>
                </div>
            </div>
        </div>
    );
};
