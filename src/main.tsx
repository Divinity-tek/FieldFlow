import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { startRuntimeAliasSync } from "./lib/helpAliasStore";
import { registerServiceWorker } from "./lib/registerSW";
import { installOfflineFetchInterceptor } from "./lib/offlineFetch";
import { startOfflineSync } from "./lib/offlineSync";

// Install the offline fetch interceptor BEFORE anything else creates a
// supabase client, so the supabase-js fetch goes through our wrapper.
installOfflineFetchInterceptor();
startOfflineSync();

startRuntimeAliasSync();
registerServiceWorker();

// Apply saved theme preference
if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);

