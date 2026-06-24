export const normalizeLogDate = (dateValue = null) => {
    if (!dateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    if (typeof dateValue === "string") {
        const dateOnlyMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }
    }

    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    return date;
};
