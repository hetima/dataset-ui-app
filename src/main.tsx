import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import i18n from "./lib/i18n";
import { AppSettings } from "./lib/settings";

const settings = await AppSettings.load();
await i18n.changeLanguage(await settings.getLanguage());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
