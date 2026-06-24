import { Link, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";
import { Gift, LogOut, Sun, Moon, Home, PlusCircle } from "lucide-react";

export default function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const { isDark, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();

    return (
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center font-bold text-xl">
                        <span className="text-emerald-600">Calorie</span>
                        <span className="text-gray-900 dark:text-white">Bank</span>
                    </Link>

                    {/* Navigation - Shown only when logged in */}
                    {user && (
                        <div className="flex items-center gap-8">
                            <Link 
                                to="/" 
                                className={`flex items-center gap-1.5 font-medium ${location.pathname === '/' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                <Home size={18} />
                                Dashboard
                            </Link>
                            
                            <Link 
                                to="/add-entry" 
                                className={`flex items-center gap-1.5 font-medium ${location.pathname === '/add-entry' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                <PlusCircle size={18} />
                                Add Entry
                            </Link>

                            <Link
                                to="/joy-bank"
                                className={`flex items-center gap-1.5 font-medium ${location.pathname === '/joy-bank' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                <Gift size={18} />
                                Joy Bank
                            </Link>
                        </div>
                    )}

                    {/* Right Side */}
                    <div className="flex items-center gap-4">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {user ? (
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:block">
                                    Hi, {user.username}
                                </span>
                                
                                <button
                                    onClick={logout}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                                >
                                    <LogOut size={18} />
                                    <span className="hidden md:inline">Logout</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link
                                    to="/login"
                                    className="px-5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Register
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
