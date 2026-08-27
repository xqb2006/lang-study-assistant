import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installViewportHeightSync } from "./services/viewportHeight";

installViewportHeightSync();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
