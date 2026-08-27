import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../App.css";
import "./converter.css";
import { ConverterApp } from "./ConverterApp";
import { installViewportHeightSync } from "../services/viewportHeight";

installViewportHeightSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConverterApp />
  </StrictMode>,
);
