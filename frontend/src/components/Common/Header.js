import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isOnCategory = location.pathname.startsWith("/category");

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="logo" onClick={() => navigate("/")}>
            📧 AI Email Sorter
          </h1>
          {isOnCategory && (
            <button onClick={() => navigate("/")} className="back-btn">
              ← Back to Dashboard
            </button>
          )}
        </div>

        <div className="header-right">
          <span className="user-info">
            <img
              src={user?.avatar || "https://via.placeholder.com/32"}
              alt="Avatar"
              className="user-avatar"
            />
            {user?.name}
          </span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
