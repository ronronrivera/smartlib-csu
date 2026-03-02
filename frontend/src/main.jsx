// Purpose: React entry point that mounts the app to the DOM root.
// Parts: root creation, strict mode, app render.
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import appFavicon from "./assets/Caraga_State_University.png";

const faviconLink = document.querySelector("link[rel='icon']");
if (faviconLink) {
    faviconLink.setAttribute("href", appFavicon);
}

// Mount the React app into the root node declared in index.html.
ReactDOM.createRoot(document.getElementById("root")).render(
    // StrictMode helps surface side-effect and lifecycle issues in development.
    <App />
);
