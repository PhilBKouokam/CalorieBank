import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { FoodLogProvider } from './context/FoodLogContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FoodLogProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </FoodLogProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
