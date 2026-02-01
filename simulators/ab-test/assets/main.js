import * as React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import { AbSimulatorRuntime } from "../components/AbSimulatorRuntime.js";

const rootEl = document.getElementById("root");
rootEl.className = "min-h-screen";

createRoot(rootEl).render(
  React.createElement(React.StrictMode, null, React.createElement(AbSimulatorRuntime))
);

