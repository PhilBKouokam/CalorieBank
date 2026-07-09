import { Link, useLocation } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ThemeContext } from "../../context/ThemeContext";
import { Gift, LogOut, Sun, Moon, Home, PlusCircle, Menu, X } from "lucide-react";

export default function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const { isDark, toggleTheme } = useContext(ThemeContext);
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navLinks = [
        { to: "/", label: "Dashboard", icon: Home },
        { to: "/add-entry", label: "Add Entry", icon: PlusCircle },
        { to: "/joy-bank", label: "Joy Bank", icon: Gift }
    ];

    const closeMenu = () => setIsMenuOpen(false);

    const handleLogout = () => {
        setIsMenuOpen(false);
        logout();
    };

    const navLinkClass = (path) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors ${
            location.pathname === path
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        }`;

    return (
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-3">
                    {/* Logo */}
                    <Link to="/" onClick={closeMenu} className="flex min-w-0 items-center font-bold text-xl">
                        <span className="text-emerald-600">Calorie</span>
                        <span className="text-gray-900 dark:text-white">Bank</span>
                    </Link>

                    {/* Navigation - Shown only when logged in */}
                    {user && (
                        <div className="hidden md:flex items-center gap-2">
                            {navLinks.map(({ to, label, icon: Icon }) => (
                                <Link key={to} to={to} className={navLinkClass(to)}>
                                    <Icon size={18} />
                                    {label}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Right Side */}
                    <div className="flex shrink-0 items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="hidden md:inline-flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle color theme"
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {user ? (
                            <div className="hidden md:flex items-center gap-4">
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
                            <div className="hidden sm:flex items-center gap-3">
                                <Link
                                    to="/login"
                                    onClick={closeMenu}
                                    className="px-5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    onClick={closeMenu}
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Register
                                </Link>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((open) => !open)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden"
                            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {isMenuOpen && (
                    <div className="border-t border-gray-200 py-3 dark:border-gray-800 md:hidden">
                        {user ? (
                            <div className="space-y-2">
                                {navLinks.map(({ to, label, icon: Icon }) => (
                                    <Link key={to} to={to} onClick={closeMenu} className={navLinkClass(to)}>
                                        <Icon size={18} />
                                        {label}
                                    </Link>
                                ))}

                                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                                    <button
                                        type="button"
                                        onClick={toggleTheme}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                    >
                                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                        {isDark ? "Light Mode" : "Dark Mode"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/50"
                                    >
                                        <LogOut size={18} />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Link
                                    to="/login"
                                    onClick={closeMenu}
                                    className="rounded-lg px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    onClick={closeMenu}
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-center font-medium text-white transition-colors hover:bg-emerald-700"
                                >
                                    Register
                                </Link>
                                <button
                                    type="button"
                                    onClick={toggleTheme}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                >
                                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                    {isDark ? "Light Mode" : "Dark Mode"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
