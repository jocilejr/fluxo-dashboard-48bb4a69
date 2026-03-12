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
const FALLBACK_DELAY = 400;

export function useWhatsAppExtension(): UseWhatsAppExtensionReturn {
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>("connecting");

  const sendPing = useCallback(() => {
    console.log("[WhatsApp Extension] Sending PING...");
    window.postMessage({ type: "WHATSAPP_EXTENSION_PING" }, "*");
  }, []);

  const retryConnection = useCallback(() => {
    setExtensionStatus("connecting");
    sendPing();
    setTimeout(() => {
      setExtensionStatus(prev => prev === "connecting" ? "disconnected" : prev);
    }, 3000);
  }, [sendPing]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "WHATSAPP_EXTENSION_READY" || event.data?.type === "WHATSAPP_EXTENSION_LOADED") {
        console.log("[WhatsApp Extension] Extension detected!", event.data.type);
        setExtensionStatus("connected");
      }
    };

    window.addEventListener("message", handleMessage);
    sendPing();
    
    const retries = [500, 1000, 2000];
    const timeouts = retries.map((delay) => setTimeout(sendPing, delay));

    const disconnectTimeout = setTimeout(() => {
      setExtensionStatus(prev => prev === "connecting" ? "disconnected" : prev);
    }, 3000);

    return () => {
      window.removeEventListener("message", handleMessage);
      timeouts.forEach(clearTimeout);
      clearTimeout(disconnectTimeout);
    };
  }, [sendPing]);

  /**
   * Sends a command using multi-protocol envelope for v1.x and v2.x compatibility.
   * Sends primary message immediately, then fallback formats after FALLBACK_DELAY.
   */
  const sendCommand = useCallback((action: string, data: Partial<WhatsAppExtensionMessage>): Promise<boolean> => {
    return new Promise((resolve) => {
      let resolved = false;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const safeResolve = (value: boolean) => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener("message", handleResponse);
        resolve(value);
      };

      const handleResponse = (event: MessageEvent) => {
        if (resolved) return;
        
        const d = event.data;
        if (!d || typeof d !== "object") return;
        
        // Skip own pings and non-response messages
        if (d.type === "WHATSAPP_EXTENSION_PING") return;
        
        // Accept responses from multiple message type formats
        const isResponse = 
          d.type === "WHATSAPP_EXTENSION_RESPONSE" ||
          d.type === "WHATSAPP_RESPONSE" ||
          d.type === `WHATSAPP_${action}_RESPONSE`;
        
        if (!isResponse) return;
        
        // Accept if requestId matches or response has no requestId
        if (d.requestId && d.requestId !== requestId) return;
        
        console.log("[WhatsApp Extension] Response received:", d);
        
        // Parse success from multiple possible paths
        const success = 
          d.success === true || 
          d.payload?.success === true || 
          d.result?.success === true;
        
        safeResolve(success);
      };

      window.addEventListener("message", handleResponse);

      // Global timeout
      setTimeout(() => {
        console.log("[WhatsApp Extension] Command timeout for", action);
        safeResolve(false);
      }, EXTENSION_TIMEOUT);

      // Phone aliases for maximum compatibility
      const phoneAliases = data.phone ? {
        phone: data.phone,
        phoneNumber: data.phone,
        number: data.phone,
      } : {};

      // === Primary message: v2.x format (WHATSAPP_OPEN_CHAT) ===
      const primaryMsg = {
        type: `WHATSAPP_${action}`,
        action,
        requestId,
        ...phoneAliases,
        ...data,
        payload: { ...data, ...phoneAliases },
      };
      console.log("[WhatsApp Hook] Primary postMessage:", JSON.stringify(primaryMsg));
      window.postMessage(primaryMsg, "*");

      // === Fallback 1: Legacy format (WHATSAPP_EXTENSION_COMMAND) ===
      setTimeout(() => {
        if (resolved) return;
        const legacyMsg = {
          type: "WHATSAPP_EXTENSION_COMMAND",
          command: action,
          action,
          requestId,
          ...phoneAliases,
          ...data,
          payload: { ...data, ...phoneAliases, action },
        };
        console.log("[WhatsApp Hook] Fallback 1 (EXTENSION_COMMAND):", JSON.stringify(legacyMsg));
        window.postMessage(legacyMsg, "*");
      }, FALLBACK_DELAY);

      // === Fallback 2: Bare action type (OPEN_CHAT) ===
      setTimeout(() => {
        if (resolved) return;
        const bareMsg = {
          type: action,
          requestId,
          ...phoneAliases,
          ...data,
          payload: { ...data, ...phoneAliases },
        };
        console.log("[WhatsApp Hook] Fallback 2 (bare action):", JSON.stringify(bareMsg));
        window.postMessage(bareMsg, "*");
      }, FALLBACK_DELAY * 2);
    });
  }, []);

  const extensionAvailable = extensionStatus === "connected";

  const openChat = useCallback(async (phone: string): Promise<boolean> => {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) {
      console.warn("[WhatsApp Hook] Invalid phone number:", phone, "→", normalized);
      return false;
    }
    console.log("[WhatsApp Hook] openChat:", { raw: phone, normalized, extensionStatus });
    return sendCommand("OPEN_CHAT", { phone: normalized });
  }, [sendCommand, extensionStatus]);

  const sendText = useCallback(async (phone: string, text: string): Promise<boolean> => {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) return false;
    return sendCommand("SEND_TEXT", { phone: normalized, text });
  }, [sendCommand]);

  const sendImage = useCallback(async (phone: string, imageDataUrl: string): Promise<boolean> => {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) return false;
    return sendCommand("SEND_IMAGE", { phone: normalized, imageDataUrl });
  }, [sendCommand]);

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
