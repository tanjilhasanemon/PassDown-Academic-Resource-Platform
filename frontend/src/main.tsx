/**
 * React 18 Application Bootstrap Entrypoint (Boundary Layer).
 *
 * Mounts the PassDown SPA wrapped inside the in-memory `AuthProvider`.
 *
 * @module main
 * @author Tanjil Hasan Emon (THE - 2331024)
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
