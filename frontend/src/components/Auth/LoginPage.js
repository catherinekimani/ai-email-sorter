import React from "react";
import { authAPI } from "../../services/api";

const LoginPage = () => {
  const handleGoogleLogin = () => {
    window.location.href = authAPI.googleLogin();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>AI Email Sorter</h1>
        <p>Organize your emails intelligently with AI-powered categorization</p>

        <div className="login-features">
          <div className="feature">
            <span className="feature-icon">📧</span>
            <span>Smart email categorization</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🤖</span>
            <span>AI-powered summaries</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🗂️</span>
            <span>Auto-archive & organize</span>
          </div>
        </div>

        <button onClick={handleGoogleLogin} className="google-login-btn">
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google"
            className="google-icon"
          />
          Sign in with Google
        </button>

        <p className="login-note">
          We'll access your Gmail to help organize and summarize your emails
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
