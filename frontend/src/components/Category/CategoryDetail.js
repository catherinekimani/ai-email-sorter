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

  const [unsubscribeResults, setUnsubscribeResults] = useState(null);

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
    const emailsToUnsubscribe = selectedEmails.filter((emailId) => {
      const email = emails.find((e) => e._id === emailId);
      return email?.unsubscribeLink && !email?.unsubscribeProcessed;
    });

    if (emailsToUnsubscribe.length === 0) {
      setError(
        "No emails available for unsubscribe (already processed or no unsubscribe link)"
      );
      return;
    }

    if (
      !window.confirm(
        `Attempt to unsubscribe from ${emailsToUnsubscribe.length} emails? This may take a few minutes.`
      )
    )
      return;

    try {
      setProcessing(true);
      setUnsubscribeResults(null);
      setError("");

      const response = await emailsAPI.bulkUnsubscribe(emailsToUnsubscribe);

      if (response && response.data) {
        const results = response.data;

        if (results.successful && results.successful > 0) {
          let successfulEmailIds = [];

          if (results.results && Array.isArray(results.results)) {
            successfulEmailIds = results.results
              .filter((result) => result.success)
              .map((result) => result.emailId)
              .filter((id) => id);
          }

          if (
            successfulEmailIds.length === 0 &&
            results.successful === emailsToUnsubscribe.length
          ) {
            successfulEmailIds = emailsToUnsubscribe;
          } else if (
            successfulEmailIds.length === 0 &&
            results.successful > 0
          ) {
            successfulEmailIds = emailsToUnsubscribe.slice(
              0,
              results.successful
            );
          }

          if (successfulEmailIds.length > 0) {
            setEmails((prevEmails) =>
              prevEmails.map((email) =>
                successfulEmailIds.includes(email._id)
                  ? {
                      ...email,
                      unsubscribeProcessed: true,
                      unsubscribeDate: new Date(),
                    }
                  : email
              )
            );
          }

          setUnsubscribeResults(results);
          setSelectedEmails([]);
          setError(
            `Success! ${results.successful} email(s) unsubscribed successfully. Check results below.`
          );
        } else if (results.total && results.total > 0) {
          setUnsubscribeResults(results);
          setSelectedEmails([]);
          setError(
            "Unsubscribe process completed. Check results below for details."
          );
        } else {
          setError("No emails were processed. Please try again.");
        }
      } else {
        setError("Unexpected response from server");
      }
    } catch (error) {
      if (error.response) {
        setError(
          `Server error: ${
            error.response.data?.message || "Unknown server error"
          }`
        );
      } else if (error.request) {
        setError("Network error - please check your connection");
      } else {
        setError(`Request failed: ${error.message}`);
      }
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
    <div className="category-detail">
      <div className="category-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2>{categoryName}</h2>
        <div className="email-count">{emails.length} emails</div>
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
                            Success{" "}
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
                {selectedEmails.some((emailId) => {
                  const email = emails.find((e) => e._id === emailId);
                  return email?.unsubscribeLink && !email?.unsubscribeProcessed;
                }) && (
                  <button
                    onClick={handleUnsubscribe}
                    className="unsubscribe-btn"
                    disabled={processing}
                  >
                    {processing
                      ? "Unsubscribing..."
                      : `Unsubscribe (${
                          selectedEmails.filter((emailId) => {
                            const email = emails.find((e) => e._id === emailId);
                            return (
                              email?.unsubscribeLink &&
                              !email?.unsubscribeProcessed
                            );
                          }).length
                        })`}
                  </button>
                )}
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
                    <div
                      className={`unsubscribe-indicator ${
                        email.unsubscribeProcessed ? "unsubscribed" : ""
                      }`}
                    >
                      {email.unsubscribeProcessed
                        ? "Successfully unsubscribed"
                        : "Unsubscribe available"}
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
