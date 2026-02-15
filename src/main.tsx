/// <reference types="vinxi/types/client" />

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";

import { createRouter } from "./router";

// Register service worker early for PWA install prompt
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(
      (reg) => console.log("SW registered:", reg.scope),
      (err) => console.warn("SW registration failed:", err)
    );
  });
}

// Capture beforeinstallprompt early — Chrome may fire it before React mounts
(window as any).__pwaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  console.log("beforeinstallprompt captured globally");
});

// Set up a Router instance
const router = createRouter();

const rootElement = document.getElementById("root")!;
const hasRealContent = rootElement.hasChildNodes() && rootElement.innerHTML.trim().length > 0;

if (!hasRealContent) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}
