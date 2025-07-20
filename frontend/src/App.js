import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./components/Auth/LoginPage";
import Dashboard from "./components/Dashboard/Dashboard";
import CategoryDetail from "./components/Category/CategoryDetail";
import "./index.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="main-content">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/category/:categoryId" element={<CategoryDetail />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
