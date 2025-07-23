import React, { useState, useEffect, useCallback, useRef } from "react";
import { categoriesAPI } from "../../services/api";
import CategoryList from "./CategoryList";
import CategoryForm from "./CategoryForm";

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
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

  const fetchAccounts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/accounts`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {}
  }, []);

  const connectAccount = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    window.location.href = `${
      process.env.REACT_APP_API_URL
    }/accounts/connect?token=${encodeURIComponent(token)}`;
  };

  const disconnectAccount = async (accountId) => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect this account? This will also remove all emails from this account."
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/accounts/${accountId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setAccounts(accounts.filter((acc) => acc._id !== accountId));

        await fetchCategories();

        setSyncStatus("Account disconnected and emails removed successfully");
        setTimeout(() => setSyncStatus(""), 3000);
      } else {
        setError("Failed to disconnect account");
      }
    } catch (error) {
      setError("Failed to disconnect account");
    }
  };

  const syncEmails = useCallback(
    async (silent = false, accountId = null) => {
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
            body: JSON.stringify(accountId ? { accountId } : {}),
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

    if (urlParams.get("connected") === "success") {
      setSyncStatus("New account connected successfully!");
      setTimeout(() => setSyncStatus(""), 3000);
      window.history.replaceState({}, document.title, "/dashboard");
    }

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetchCategories();
    fetchAccounts();
  }, [fetchCategories, fetchAccounts]);

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

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");

      setSyncStatus("Logging out...");

      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  };

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
            {syncing ? "⏳ Syncing..." : "Sync Emails"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="add-category-btn"
          >
            + Add Category
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
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
        <div className="gmail-accounts">
          <h3>📬 Connected Gmail Accounts</h3>
          {accounts.length === 0 ? (
            <div className="no-accounts">
              <p>No Gmail accounts connected</p>
              <button onClick={connectAccount} className="connect-btn">
                + Connect Gmail Account
              </button>
            </div>
          ) : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div key={account._id} className="account-card">
                  <div className="account-info">
                    <span className="account-email">{account.email}</span>
                    {account.isPrimary && (
                      <span className="primary-badge">Primary</span>
                    )}
                    <div className="account-actions">
                      <button
                        onClick={() => syncEmails(false, account._id)}
                        className="sync-account-btn"
                        disabled={syncing}
                      >
                        🔄
                      </button>
                      {!account.isPrimary && (
                        <button
                          onClick={() => disconnectAccount(account._id)}
                          className="disconnect-btn"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={connectAccount} className="connect-btn">
                + Connect Another Account
              </button>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="connection-status">
              <span className="status-indicator active"></span>
              <span>{accounts.length} account(s) connected</span>
              {syncing && <span className="sync-indicator">🔄</span>}
            </div>
          )}

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
