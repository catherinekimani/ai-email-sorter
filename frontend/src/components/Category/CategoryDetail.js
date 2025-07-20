import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { emailsAPI } from "../../services/api";

const CategoryDetail = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedEmailContent, setSelectedEmailContent] = useState(null);
  const [categoryName, setCategoryName] = useState("");

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await emailsAPI.getByCategory(categoryId);
      setEmails(response.data);

      if (response.data.length > 0) {
        setCategoryName("Category Details");
      }
    } catch (error) {
      setError("Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleSelectEmail = (emailId) => {
    setSelectedEmails((prev) =>
      prev.includes(emailId)
        ? prev.filter((id) => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(emails.map((email) => email._id));
    }
  };

  const handleDelete = async () => {
    if (selectedEmails.length === 0) return;

    if (!window.confirm(`Delete ${selectedEmails.length} selected emails?`)) {
      return;
    }

    try {
      setProcessing(true);
      await emailsAPI.bulkDelete(selectedEmails);
      setEmails(emails.filter((email) => !selectedEmails.includes(email._id)));
      setSelectedEmails([]);
    } catch (error) {
      setError("Failed to delete emails");
    } finally {
      setProcessing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (selectedEmails.length === 0) return;

    if (
      !window.confirm(
        `Unsubscribe from ${selectedEmails.length} selected emails?`
      )
    ) {
      return;
    }

    try {
      setProcessing(true);
      const response = await emailsAPI.bulkUnsubscribe(selectedEmails);

      const successful = response.data.filter((r) => r.success).length;
      const failed = response.data.length - successful;

      if (successful > 0) {
        alert(
          `Successfully unsubscribed from ${successful} emails${
            failed > 0 ? `, ${failed} failed` : ""
          }`
        );
      } else {
        alert("No unsubscribe actions were successful");
      }

      setSelectedEmails([]);
    } catch (error) {
      setError("Failed to unsubscribe from emails");
    } finally {
      setProcessing(false);
    }
  };

  const handleEmailClick = (email) => {
    setSelectedEmailContent(email);
  };

  const closeEmailModal = () => {
    setSelectedEmailContent(null);
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
    <div className="category-detail">
      <div className="category-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2>{categoryName}</h2>
        <div className="email-count">{emails.length} emails</div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {emails.length === 0 ? (
        <div className="empty-state">
          <p>No emails in this category yet.</p>
        </div>
      ) : (
        <>
          <div className="category-actions">
            <div className="selection-actions">
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={selectedEmails.length === emails.length}
                  onChange={handleSelectAll}
                />
                Select All ({emails.length})
              </label>
              {selectedEmails.length > 0 && (
                <span className="selected-count">
                  {selectedEmails.length} selected
                </span>
              )}
            </div>

            {selectedEmails.length > 0 && (
              <div className="bulk-actions">
                <button
                  onClick={handleDelete}
                  className="delete-btn"
                  disabled={processing}
                >
                  {processing
                    ? "Deleting..."
                    : `Delete (${selectedEmails.length})`}
                </button>
                <button
                  onClick={handleUnsubscribe}
                  className="unsubscribe-btn"
                  disabled={processing}
                >
                  {processing
                    ? "Unsubscribing..."
                    : `Unsubscribe (${selectedEmails.length})`}
                </button>
              </div>
            )}
          </div>

          <div className="emails-list">
            {emails.map((email) => (
              <div
                key={email._id}
                className={`email-item ${
                  selectedEmails.includes(email._id) ? "selected" : ""
                }`}
              >
                <div className="email-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedEmails.includes(email._id)}
                    onChange={() => handleSelectEmail(email._id)}
                  />
                </div>

                <div
                  className="email-content"
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="email-header">
                    <div className="email-from">{email.from}</div>
                    <div className="email-date">
                      {new Date(email.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="email-subject">{email.subject}</div>
                  <div className="email-summary">
                    {email.aiSummary || "No summary available"}
                  </div>
                  {email.unsubscribeLink && (
                    <div className="unsubscribe-indicator">
                      📧 Unsubscribe available
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedEmailContent && (
        <div className="email-modal-overlay" onClick={closeEmailModal}>
          <div className="email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Email Details</h3>
              <button onClick={closeEmailModal} className="close-btn">
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="email-meta">
                <div>
                  <strong>From:</strong> {selectedEmailContent.from}
                </div>
                <div>
                  <strong>Subject:</strong> {selectedEmailContent.subject}
                </div>
                <div>
                  <strong>Date:</strong>{" "}
                  {new Date(selectedEmailContent.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="email-summary-section">
                <h4>AI Summary</h4>
                <p>
                  {selectedEmailContent.aiSummary || "No summary available"}
                </p>
              </div>
              <div className="email-body-section">
                <h4>Original Content</h4>
                <div
                  className="email-body"
                  dangerouslySetInnerHTML={{
                    __html: selectedEmailContent.body,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDetail;
