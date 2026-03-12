import { useState, useEffect, useCallback } from "react";

interface WhatsAppExtensionMessage {
  type: string;
  action?: string;
  phone?: string;
  text?: string;
  imageDataUrl?: string;
  success?: boolean;
  error?: string;
  requestId?: string;
}

export type ExtensionStatus = "disconnected" | "connecting" | "connected";

interface UseWhatsAppExtensionReturn {
  extensionAvailable: boolean;
  extensionStatus: ExtensionStatus;
  openChat: (phone: string) => Promise<boolean>;
  sendText: (phone: string, text: string) => Promise<boolean>;
  sendImage: (phone: string, imageDataUrl: string) => Promise<boolean>;
  fallbackOpenWhatsApp: (phone: string, text?: string) => void;
  retryConnection: () => void;
}

const EXTENSION_TIMEOUT = 10000;

export function useWhatsAppExtension(): UseWhatsAppExtensionReturn {
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>("connecting");

  const sendPing = useCallback(() => {
    console.log("[WhatsApp Extension] Sending PING...");
    window.postMessage({ type: "WHATSAPP_EXTENSION_PING" }, "*");
  }, []);

  const retryConnection = useCallback(() => {
    setExtensionStatus("connecting");
    sendPing();
    
    // Set timeout to mark as disconnected if no response
    setTimeout(() => {
      setExtensionStatus(prev => prev === "connecting" ? "disconnected" : prev);
    }, 3000);
  }, [sendPing]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("[WhatsApp Extension] Message received:", event.data);
      if (event.data?.type === "WHATSAPP_EXTENSION_READY") {
        console.log("[WhatsApp Extension] Extension detected!");
        setExtensionStatus("connected");
      }
    };

    window.addEventListener("message", handleMessage);

    // Try immediately
    sendPing();
    
    // Retry after short delays in case content script loads late
    const retries = [500, 1000, 2000];
    const timeouts = retries.map((delay) => 
      setTimeout(sendPing, delay)
    );

    // Mark as disconnected after all retries
    const disconnectTimeout = setTimeout(() => {
      setExtensionStatus(prev => prev === "connecting" ? "disconnected" : prev);
    }, 3000);

    return () => {
      window.removeEventListener("message", handleMessage);
      timeouts.forEach(clearTimeout);
      clearTimeout(disconnectTimeout);
    };
  }, [sendPing]);

  const sendCommand = useCallback((action: string, data: Partial<WhatsAppExtensionMessage>): Promise<boolean> => {
    return new Promise((resolve) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log("[WhatsApp Extension] Sending command:", action, data, "requestId:", requestId);
      
      const handleResponse = (event: MessageEvent) => {
        // Verifica se é uma resposta para este comando
        const isResponse = event.data?.type === "WHATSAPP_EXTENSION_RESPONSE" || event.data?.type === "WHATSAPP_RESPONSE";
        // Accept response if requestId matches OR if response has no requestId (extension bridge compatibility)
        const matchesRequest = !event.data?.requestId || event.data?.requestId === requestId;
        
        if (isResponse && matchesRequest) {
          console.log("[WhatsApp Extension] Response matched:", event.data);
          window.removeEventListener("message", handleResponse);
          const success = event.data.success === true || event.data.payload?.success === true;
          console.log("[WhatsApp Extension] Command success:", success);
          resolve(success);
        }
      };

      window.addEventListener("message", handleResponse);

      setTimeout(() => {
        window.removeEventListener("message", handleResponse);
        console.log("[WhatsApp Extension] Command timeout");
        resolve(false);
      }, EXTENSION_TIMEOUT);

      // Envia no formato que o content-dashboard.js espera
      const msg = {
        type: `WHATSAPP_${action}`,
        requestId,
        payload: data,
      };
      console.log("[WhatsApp Hook] postMessage enviado:", JSON.stringify(msg));
      window.postMessage(msg, "*");
    });
  }, []);

  const extensionAvailable = extensionStatus === "connected";

  const openChat = useCallback(async (phone: string): Promise<boolean> => {
    const normalized = normalizePhone(phone);
    console.log("[WhatsApp Hook] openChat chamado:", { raw: phone, normalized, extensionStatus });
    return sendCommand("OPEN_CHAT", { phone: normalized });
  }, [sendCommand, extensionStatus]);

  const sendText = useCallback(async (phone: string, text: string): Promise<boolean> => {
    if (!extensionAvailable) return false;
    return sendCommand("SEND_TEXT", { phone: normalizePhone(phone), text });
  }, [extensionAvailable, sendCommand]);

  const sendImage = useCallback(async (phone: string, imageDataUrl: string): Promise<boolean> => {
    if (!extensionAvailable) return false;
    return sendCommand("SEND_IMAGE", { phone: normalizePhone(phone), imageDataUrl });
  }, [extensionAvailable, sendCommand]);

  const fallbackOpenWhatsApp = useCallback((phone: string, text?: string) => {
    const normalizedPhone = normalizePhone(phone);
    const url = text
      ? `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?phone=${normalizedPhone}`;
    window.open(url, "_blank");
  }, []);

  return {
    extensionAvailable,
    extensionStatus,
    openChat,
    sendText,
    sendImage,
    fallbackOpenWhatsApp,
    retryConnection,
  };
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^\d]/g, "");
  
  if (!normalized.startsWith("55")) {
    normalized = "55" + normalized;
  }
  
  return normalized;
}
