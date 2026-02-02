import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "@shopify/polaris";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import "@shopify/polaris/build/esm/styles.css";
import App from "./App";

// Get config from URL params (Shopify embeds these)
const urlParams = new URLSearchParams(window.location.search);
const host = urlParams.get("host");
const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || "44c8c1d17fe49a73270b6ed561da50e7";

const config = {
  apiKey: apiKey,
  host: host,
  forceRedirect: true,
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppBridgeProvider config={config}>
      <AppProvider i18n={{}}>
        <App />
      </AppProvider>
    </AppBridgeProvider>
  </React.StrictMode>
);
