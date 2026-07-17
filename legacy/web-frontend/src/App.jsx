import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import { ThemeContext } from "./context/ThemeContext";

//Pages
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AddEntry from "./pages/AddEntry.jsx";
import JoyBankingCenter from "./pages/JoyBankingCenter.jsx";

//Components
import Navbar from "./components/Layout/Navbar.jsx";

function ProtectedRoute ({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return user ? children : <Navigate to="/login" />;
}

function App() {
  const { isDark } = useContext(ThemeContext);

  return (
    <div className={`min-h-screen overflow-x-hidden ${isDark ? 'dark' : ''}`}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/add-entry"
            element={
              <ProtectedRoute>
                <AddEntry />
              </ProtectedRoute>
            }
          />

          <Route
            path="/joy-bank"
            element={
              <ProtectedRoute>
                <JoyBankingCenter />
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
