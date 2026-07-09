export default function DailyBank({ log, user, weeklyBank }) {
    if (!log) return null;

    const bank = weeklyBank?.bankBalance || 0;
    const isPositive = bank >= 0;
    const consumedCalories = log.entries.reduce((sum, e) => sum + (e.calories || 0), 0);
    const dailyCalorieIntake = user?.dailyCalorieIntake || 2000;
    const dailyBurn = user?.tdee || 2000;
    const extraBurn = log.burnedCalories || 0;

    return (
        <div className="card p-5 text-center sm:p-8">
            <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 sm:text-sm">
                Calorie Bank
            </p>

            <div className={`text-5xl font-bold mb-2 sm:text-6xl ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{bank}
            </div>

            <p className="text-base text-gray-600 dark:text-gray-400 sm:text-lg">
                calories {isPositive ? 'banked' : 'surplus'} this week through yesterday
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 dark:text-gray-400">Consumed</p>
                    <p className="text-2xl font-semibold mt-1">
                        {consumedCalories}
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 dark:text-gray-400">Daily Intake</p>
                    <p className="text-2xl font-semibold mt-1">
                        {dailyCalorieIntake}
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 dark:text-gray-400">Estimated Daily Burn (TDEE)</p>
                    <p className="text-2xl font-semibold mt-1">
                        {dailyBurn}
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 dark:text-gray-400">Extra Burn</p>
                    <p className="text-2xl font-semibold mt-1">
                        {extraBurn}
                    </p>
                </div>
            </div>
        </div>
    );
};
