import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[Main] Starting app initialization...");

const rootElement = document.getElementById("root");

if (rootElement) {
  console.log("[Main] Root element found, creating React root...");
  
  try {
    // Clear loading indicator
    rootElement.innerHTML = '';
    
    const root = createRoot(rootElement);
    console.log("[Main] React root created, rendering App...");
    
    root.render(<App />);
    console.log("[Main] App rendered successfully");
  } catch (error) {
    console.error("[Main] Error rendering app:", error);
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0c0f; color: #fff; padding: 20px; text-align: center;">
        <div>
          <h1 style="color: #ef4444; margin-bottom: 16px;">Erro ao carregar aplicação</h1>
          <p style="color: #94a3b8; margin-bottom: 16px;">${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
          <button onclick="window.location.reload()" style="background: #22c55e; color: #000; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">
            Recarregar
          </button>
        </div>
      </div>
    `;
  }
} else {
  console.error("[Main] Root element not found!");
}
