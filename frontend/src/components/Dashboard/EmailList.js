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
  const [unsubscribeResults, setUnsubscribeResults] = useState(null);

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
      const response = await emailsAPI.bulkDelete(selectedEmails);
      setEmails(emails.filter((email) => !selectedEmails.includes(email._id)));
      setSelectedEmails([]);

      setError(`✅ ${response.data.deletedCount} emails deleted successfully`);
      setTimeout(() => setError(""), 3000);
    } catch (error) {
      setError("Failed to delete emails");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (selectedEmails.length === 0) return;

    if (
      !window.confirm(
        `Attempt to unsubscribe from ${selectedEmails.length} emails? This may take a few minutes.`
      )
    )
      return;

    try {
      setActionLoading(true);
      setUnsubscribeResults(null);
      setError("");

      const response = await emailsAPI.bulkUnsubscribe(selectedEmails);

      if (response && response.data) {
        const results = response.data || {};
        setUnsubscribeResults(results);
        setSelectedEmails([]);

        const successCount = results.successful || 0;
        const totalCount = results.total || 0;

        if (successCount > 0) {
          setError(
            `Success! ${successCount}/${totalCount} emails unsubscribed. Check results below.`
          );
        } else {
          setError(
            "Unsubscribe process completed. Check results below for details."
          );
        }
      } else {
        setError("❌ Unexpected response format");
      }
    } catch (error) {
      setError("❌ Request failed");
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

  const clearUnsubscribeResults = () => {
    setUnsubscribeResults(null);
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
                  {actionLoading
                    ? "Deleting..."
                    : `Delete (${selectedEmails.length})`}
                </button>
                <button
                  onClick={handleBulkUnsubscribe}
                  className="unsubscribe-btn"
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Unsubscribing..."
                    : `Unsubscribe (${selectedEmails.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          className={`error-message ${
            error.startsWith("✅") ? "success-message" : ""
          }`}
        >
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {unsubscribeResults && (
        <div className="unsubscribe-results">
          <div className="results-header">
            <h3>Unsubscribe Results</h3>
            <button onClick={clearUnsubscribeResults} className="close-results">
              ×
            </button>
          </div>

          <div className="results-summary">
            <p>
              <strong>Total:</strong> {unsubscribeResults.total || 0}
            </p>
            <p>
              <strong>Successful:</strong> {unsubscribeResults.successful || 0}
            </p>
            <p>
              <strong>Failed:</strong> {unsubscribeResults.failed || 0}
            </p>
            {unsubscribeResults.alreadyUnsubscribed > 0 && (
              <p>
                <strong>Already Unsubscribed:</strong>{" "}
                {unsubscribeResults.alreadyUnsubscribed}
              </p>
            )}
            {unsubscribeResults.noUnsubscribeLink > 0 && (
              <p>
                <strong>No Unsubscribe Link:</strong>{" "}
                {unsubscribeResults.noUnsubscribeLink}
              </p>
            )}
          </div>

          {unsubscribeResults.results &&
            unsubscribeResults.results.length > 0 && (
              <div className="results-details">
                <h4>Details:</h4>
                <div className="results-list">
                  {unsubscribeResults.results.map((result, index) => (
                    <div
                      key={index}
                      className={`result-item ${
                        result.success ? "success" : "failed"
                      }`}
                    >
                      <div className="result-email">
                        <strong>
                          {result.subject || `Email ${index + 1}`}
                        </strong>
                      </div>
                      <div className="result-status">
                        {result.success ? (
                          <span className="success-text">
                            ✅ Success{" "}
                            {result.strategy && `(Strategy ${result.strategy})`}
                            {result.wasAlreadyUnsubscribed &&
                              " - Already unsubscribed"}
                            {result.message && (
                              <div className="result-message">
                                {result.message}
                              </div>
                            )}
                          </span>
                        ) : (
                          <span className="error-text">
                            Failed
                            {result.reason === "NO_UNSUBSCRIBE_LINK" &&
                              " - No unsubscribe link"}
                            {result.reason === "ALREADY_UNSUBSCRIBED" &&
                              " - Already unsubscribed"}
                            {result.reason === "INVALID_URL" &&
                              " - Invalid URL"}
                            {result.error && (
                              <div className="result-message">
                                {result.error}
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                    {new Date(
                      email.receivedDate || email.date
                    ).toLocaleDateString()}
                  </p>
                  {email.unsubscribeLink && (
                    <p className="email-unsubscribe-info">
                      Unsubscribe link available
                    </p>
                  )}
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
