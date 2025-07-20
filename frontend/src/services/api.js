import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  googleLogin: () => `${API_BASE_URL}/auth/google`,
  getMe: () => api.get("/auth/me"),
};

// Categories API calls
export const categoriesAPI = {
  getAll: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Emails API calls
export const emailsAPI = {
  getByCategory: (categoryId) => api.get(`/emails/category/${categoryId}`),
  bulkDelete: (emailIds) => api.delete("/emails/bulk", { data: { emailIds } }),
  bulkUnsubscribe: (emailIds) => api.post("/emails/unsubscribe", { emailIds }),
  getContent: (emailId) => api.get(`/emails/${emailId}/content`),
};
