document.querySelector("#noscript")?.remove();

import React from "react";
import ReactDOM from "react-dom/client";
import { Terminal } from "./components/terminal";

import.meta.glob("./styles/*.scss", { eager: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Terminal />
  </React.StrictMode>,
);
