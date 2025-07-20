import React from "react";
import { useNavigate } from "react-router-dom";

const CategoryList = ({ categories, onDeleteCategory }) => {
  const navigate = useNavigate();

  if (categories.length === 0) {
    return (
      <div className="empty-state">
        <h3>No categories yet</h3>
        <p>Create your first category to start organizing emails</p>
      </div>
    );
  }

  return (
    <div className="categories-section">
      <h3>Your Categories</h3>
      <div className="categories-grid">
        {categories.map((category) => (
          <div key={category._id} className="category-card">
            <div
              className="category-content"
              onClick={() => navigate(`/category/${category._id}`)}
            >
              <h4>{category.name}</h4>
              <p className="category-description">{category.description}</p>
              <div className="category-stats">
                <span className="email-count">
                  {category.emailCount || 0} emails
                </span>
              </div>
            </div>

            <div className="category-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCategory(category._id);
                }}
                className="delete-btn"
                title="Delete category"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryList;
