import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { emailsAPI, categoriesAPI } from "../../services/api";

const EmailList = () => {
  const { categoryId } = useParams();
  const [emails, setEmails] = useState([]);
  const [category, setCategory] = useState(null);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedEmail, setExpandedEmail] = useState(null);

  useEffect(() => {
    fetchEmails();
    fetchCategory();
  }, [categoryId]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await emailsAPI.getByCategory(categoryId);
      setEmails(response.data);
    } catch (error) {
      setError("Failed to load emails");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategory = async () => {
    try {
      const categories = await categoriesAPI.getAll();
      const currentCategory = categories.data.find(
        (cat) => cat._id === categoryId
      );
      setCategory(currentCategory);
    } catch (error) {}
  };

  const handleSelectEmail = (emailId) => {
    setSelectedEmails((prev) =>
      prev.includes(emailId)
        ? prev.filter((id) => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAll = () => {
    setSelectedEmails(
      selectedEmails.length === emails.length
        ? []
        : emails.map((email) => email._id)
    );
  };

  const handleBulkDelete = async () => {
    if (selectedEmails.length === 0) return;

    if (!window.confirm(`Delete ${selectedEmails.length} emails?`)) return;

    try {
      setActionLoading(true);
      await emailsAPI.bulkDelete(selectedEmails);
      setEmails(emails.filter((email) => !selectedEmails.includes(email._id)));
      setSelectedEmails([]);
    } catch (error) {
      setError("Failed to delete emails");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (selectedEmails.length === 0) return;

    if (!window.confirm(`Unsubscribe from ${selectedEmails.length} emails?`))
      return;

    try {
      setActionLoading(true);
      await emailsAPI.bulkUnsubscribe(selectedEmails);
      alert("Unsubscribe process started! This may take a few minutes.");
      setSelectedEmails([]);
    } catch (error) {
      setError("Failed to unsubscribe");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExpandEmail = async (emailId) => {
    if (expandedEmail === emailId) {
      setExpandedEmail(null);
      return;
    }

    try {
      const response = await emailsAPI.getContent(emailId);
      setExpandedEmail({ id: emailId, content: response.data.content });
    } catch (error) {
      setError("Failed to load email content");
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading emails...</p>
      </div>
    );
  }

  return (
    <div className="email-list-container">
      <div className="email-list-header">
        <h2>{category?.name || "Category"}</h2>
        <p className="category-description">{category?.description}</p>

        {emails.length > 0 && (
          <div className="bulk-actions">
            <div className="select-controls">
              <label>
                <input
                  type="checkbox"
                  checked={selectedEmails.length === emails.length}
                  onChange={handleSelectAll}
                />
                Select All ({emails.length})
              </label>
              <span className="selected-count">
                {selectedEmails.length} selected
              </span>
            </div>

            {selectedEmails.length > 0 && (
              <div className="action-buttons">
                <button
                  onClick={handleBulkDelete}
                  className="delete-btn"
                  disabled={actionLoading}
                >
                  Delete ({selectedEmails.length})
                </button>
                <button
                  onClick={handleBulkUnsubscribe}
                  className="unsubscribe-btn"
                  disabled={actionLoading}
                >
                  Unsubscribe ({selectedEmails.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {emails.length === 0 ? (
        <div className="empty-state">
          <h3>No emails in this category yet</h3>
          <p>New emails will appear here when they match this category</p>
        </div>
      ) : (
        <div className="emails-list">
          {emails.map((email) => (
            <div key={email._id} className="email-card">
              <div className="email-header">
                <label className="email-select">
                  <input
                    type="checkbox"
                    checked={selectedEmails.includes(email._id)}
                    onChange={() => handleSelectEmail(email._id)}
                  />
                </label>

                <div className="email-info">
                  <h4>{email.subject}</h4>
                  <p className="email-from">From: {email.from}</p>
                  <p className="email-date">
                    {new Date(email.date).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={() => handleExpandEmail(email._id)}
                  className="expand-btn"
                >
                  {expandedEmail?.id === email._id ? "▼" : "▶"}
                </button>
              </div>

              <div className="email-summary">
                <strong>AI Summary:</strong>{" "}
                {email.aiSummary || "Processing..."}
              </div>

              {expandedEmail?.id === email._id && (
                <div className="email-content">
                  <h5>Full Email Content:</h5>
                  <div
                    className="email-body"
                    dangerouslySetInnerHTML={{ __html: expandedEmail.content }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailList;
