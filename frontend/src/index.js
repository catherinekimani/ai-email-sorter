import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/components/Auth.css";
import "./styles/components/Header.css";
import "./styles/components/Dashboard.css";
import "./styles/components/Category.css";
import "./styles/components/Modal.css";
import "./styles/utils/loading.css";
import "./styles/utils/responsive.css";
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
