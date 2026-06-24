import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(getStoredUser());
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    // Load user from token on app start
    useEffect(() => {
        const initializeAuth = async () => {
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            } 

            setLoading(true);
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const storedUser = getStoredUser();

                setUser({
                    ...storedUser,
                    id: payload.userId,
                    username: payload.username || "User",
                    ...payload,
                    dailyCalorieIntake: payload.dailyCalorieIntake || storedUser?.dailyCalorieIntake || 2000,
                    tdee: payload.tdee || storedUser?.tdee || 2000
                });
            } catch(error) {
                console.error("Invalid token");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                setToken(null);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, [token]);

    const login = (newToken, loggedInUser = null) => {
        if (!newToken) return;
        localStorage.setItem("token", newToken);
        setToken(newToken);

        if (loggedInUser) {
            localStorage.setItem("user", JSON.stringify(loggedInUser));
            setUser(loggedInUser);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setUser(null);
        setLoading(true);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
