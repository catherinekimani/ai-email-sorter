import React, { useState, useEffect, useCallback, useRef } from "react";
import { categoriesAPI } from "../../services/api";
import CategoryList from "./CategoryList";
import CategoryForm from "./CategoryForm";

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const hasAutoSynced = useRef(false);
  const [showReconnect, setShowReconnect] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await categoriesAPI.getAll();
      setCategories(response.data);
    } catch (error) {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncEmails = useCallback(
    async (silent = false) => {
      if (categories.length === 0 && !silent) {
        setError("Please create at least one category before syncing emails");
        return;
      }

      try {
        setSyncing(true);
        if (!silent) {
          setSyncStatus("Fetching new emails...");
        }

        const token = localStorage.getItem("token");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/emails/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();

          if (
            errorData.message?.includes("auth expired") ||
            errorData.message?.includes("invalid_grant") ||
            response.status === 401 ||
            response.status === 403
          ) {
            setShowReconnect(true);
            return;
          }

          throw new Error(`Sync failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!silent) {
          setSyncStatus(data.msg);
          setTimeout(() => setSyncStatus(""), 3000);
        }

        if (data.msg && !data.msg.includes("0 emails")) {
          await fetchCategories();
        }
      } catch (error) {
        if (!silent) {
          setError("Failed to sync emails: " + error.message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [categories.length, fetchCategories]
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      window.history.replaceState({}, document.title, "/dashboard");
    }

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (
      !loading &&
      categories.length > 0 &&
      !syncing &&
      !hasAutoSynced.current
    ) {
      hasAutoSynced.current = true;
      syncEmails(true);
    }
  }, [categories.length, loading, syncing, syncEmails]);

  const handleCreateCategory = async (categoryData) => {
    try {
      const response = await categoriesAPI.create(categoryData);
      setCategories([...categories, response.data]);
      setShowForm(false);
      setError("");

      if (categories.length === 0) {
        hasAutoSynced.current = false;
        setTimeout(() => syncEmails(true), 1000);
      }
    } catch (error) {
      setError("Failed to create category");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      await categoriesAPI.delete(categoryId);
      setCategories(categories.filter((cat) => cat._id !== categoryId));
    } catch (error) {
      setError("Failed to delete category");
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Email Categories</h2>
        <div className="header-actions">
          <button
            onClick={() => syncEmails()}
            className="sync-btn"
            disabled={syncing || categories.length === 0}
            title={
              categories.length === 0
                ? "Create a category first"
                : "Sync new emails"
            }
          >
            {syncing ? "⏳ Syncing..." : "🔄 Sync Emails"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="add-category-btn"
          >
            + Add Category
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {syncStatus && <div className="success-message">{syncStatus}</div>}
      {showReconnect && (
        <div className="error-message">
          Your Gmail connection has expired.
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/auth/google";
            }}
            className="reconnect-btn"
          >
            🔁 Reconnect Gmail
          </button>
        </div>
      )}
      <div className="dashboard-content">
        <div className="gmail-connection">
          <h3>📬 Gmail Connection</h3>
          <p>Connected and monitoring for new emails</p>
          <div className="connection-status">
            <span className="status-indicator active"></span>
            <span>Active</span>
            {syncing && <span className="sync-indicator">🔄</span>}
          </div>
          {categories.length === 0 && (
            <div className="setup-notice">
              <p>⚠️ Create your first category to start sorting emails!</p>
            </div>
          )}
        </div>

        <CategoryList
          categories={categories}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>

      {showForm && (
        <CategoryForm
          onSubmit={handleCreateCategory}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
