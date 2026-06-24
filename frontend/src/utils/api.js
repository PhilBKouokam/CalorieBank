const API_BASE_URL = import.meta.env.MODE === "development"
    ? "http://localhost:4700"
    : "https://caloriebank-backend.onrender.com";   // ← Update this

export const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem("token");

    const config = {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    };

    // Don't set Content-Type for FormData (photo uploads)
    if (options.body instanceof FormData) {
        delete config.headers["Content-Type"];
    }

    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;

    try {
        const response = await fetch(fullUrl, config);

        if (response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/login";
            return response;
        }

        return response;
    } catch (error) {
        console.error("API Fetch Error:", error);
        throw error;
    }
};
