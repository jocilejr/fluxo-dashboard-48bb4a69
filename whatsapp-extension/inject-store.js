// inject-store.js — Runs in MAIN world to access WhatsApp Web's webpack modules
// Exposes window.WStore for use by the content script via custom events

(function () {
  'use strict';

  const LOG_PREFIX = '[WStore Inject]';
  let storeReady = false;

  // Known module search patterns (multiple fallbacks)
  const MODULE_PATTERNS = {
    Chat: [
      m => m.Chat && m.Chat.find,
      m => m.ChatCollection && m.ChatCollection.find,
      m => m.default?.Chat?.find,
    ],
    Cmd: [
      m => m.Cmd,
      m => m.default?.Cmd,
    ],
    WapQuery: [
      m => m.queryExists,
      m => m.default?.queryExists,
    ],
    ContactStore: [
      m => m.Contact && m.Contact.find,
      m => m.default?.Contact?.find,
    ],
    MsgStore: [
      m => m.Msg && m.Msg.find,
      m => m.default?.Msg?.find,
    ],
  };

  function scanModules() {
    // Method 1: window.require (webpack)
    if (typeof window.require === 'function') {
      try {
        return scanViaRequire();
      } catch (e) {
        console.warn(LOG_PREFIX, 'require scan failed:', e.message);
      }
    }

    // Method 2: Scan webpack chunks
    const wpKey = Object.keys(window).find(k => 
      k.startsWith('webpackChunk') || k.startsWith('__d')
    );
    if (wpKey && window[wpKey]) {
      try {
        return scanViaChunks(wpKey);
      } catch (e) {
        console.warn(LOG_PREFIX, 'chunk scan failed:', e.message);
      }
    }

    return null;
  }

  function scanViaRequire() {
    const modules = {};

    // Try to get the module map via require.m or similar
    const moduleMap = window.require.m || window.require.c;
    if (!moduleMap) return null;

    const entries = typeof moduleMap === 'object' ? Object.values(moduleMap) : [];
    
    for (const mod of entries) {
      try {
        const exported = typeof mod === 'function' ? mod : (mod?.exports || mod);
        if (!exported || typeof exported !== 'object') continue;

        for (const [name, patterns] of Object.entries(MODULE_PATTERNS)) {
          if (modules[name]) continue;
          for (const test of patterns) {
            try {
              const result = test(exported);
              if (result) {
                modules[name] = result;
                console.log(LOG_PREFIX, `Found module: ${name}`);
                break;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return Object.keys(modules).length > 0 ? modules : null;
  }

  function scanViaChunks(wpKey) {
    const modules = {};
    const cache = {};

    // Inject a fake module to access the require function
    const chunkArray = window[wpKey];
    
    let resolvedRequire = null;

    // Push a fake chunk to intercept require
    chunkArray.push([
      [Math.random().toString(36)],
      {},
      function (req) {
        resolvedRequire = req;
      }
    ]);

    if (!resolvedRequire || !resolvedRequire.c) return null;

    const moduleCache = resolvedRequire.c;

    for (const id in moduleCache) {
      try {
        const mod = moduleCache[id];
        const exported = mod?.exports;
        if (!exported || typeof exported !== 'object') continue;

        // Check direct exports and default
        const targets = [exported, exported.default].filter(Boolean);

        for (const target of targets) {
          for (const [name, patterns] of Object.entries(MODULE_PATTERNS)) {
            if (modules[name]) continue;
            for (const test of patterns) {
              try {
                const result = test(target);
                if (result) {
                  modules[name] = result;
                  console.log(LOG_PREFIX, `Found module via chunks: ${name}`);
                  break;
                }
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }

    return Object.keys(modules).length > 0 ? modules : null;
  }

  // High-level API exposed via window.WStore
  function createStoreAPI(modules) {
    const api = {
      _modules: modules,
      _ready: true,

      /**
       * Open a chat by phone number (no DOM selectors needed)
       * @param {string} phone - Full phone with country code (e.g., "5511999999999")
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async openChat(phone) {
        const jid = phone.includes('@') ? phone : `${phone}@c.us`;
        console.log(LOG_PREFIX, 'openChat:', jid);

        // Method 1: Chat.find + Cmd.openChatAt
        if (modules.Chat?.find) {
          try {
            const chat = await modules.Chat.find(jid);
            if (chat) {
              if (modules.Cmd?.openChatAt) {
                modules.Cmd.openChatAt(chat);
              } else if (modules.Cmd?.openChatBottom) {
                modules.Cmd.openChatBottom(chat);
              }
              return { success: true, method: 'Chat.find' };
            }
          } catch (e) {
            console.warn(LOG_PREFIX, 'Chat.find failed:', e.message);
          }
        }

        // Method 2: WapQuery.queryExists + Chat.find
        if (modules.WapQuery?.queryExists) {
          try {
            const result = await modules.WapQuery.queryExists(jid);
            if (result?.wid) {
              const chat = await modules.Chat?.find(result.wid);
              if (chat && modules.Cmd) {
                modules.Cmd.openChatAt?.(chat) || modules.Cmd.openChatBottom?.(chat);
                return { success: true, method: 'WapQuery' };
              }
            }
          } catch (e) {
            console.warn(LOG_PREFIX, 'WapQuery failed:', e.message);
          }
        }

        // Method 3: Dispatch internal navigation event
        try {
          const chatFindByPhone = modules.Chat?.findByPhone || modules.Chat?.search;
          if (chatFindByPhone) {
            const chat = await chatFindByPhone(phone);
            if (chat) {
              return { success: true, method: 'findByPhone' };
            }
          }
        } catch (e) {
          console.warn(LOG_PREFIX, 'findByPhone failed:', e.message);
        }

        return { success: false, error: 'All Store methods exhausted' };
      },

      /**
       * Check if Store modules are loaded
       */
      isReady() {
        return !!modules.Chat;
      },

      /**
       * Get available module names
       */
      getModules() {
        return Object.keys(modules);
      }
    };

    return api;
  }

  // Retry scanning until modules are found
  let attempts = 0;
  const MAX_ATTEMPTS = 30;
  const SCAN_INTERVAL = 2000;

  function tryInit() {
    attempts++;
    console.log(LOG_PREFIX, `Scan attempt ${attempts}/${MAX_ATTEMPTS}...`);

    const modules = scanModules();

    if (modules && Object.keys(modules).length > 0) {
      window.WStore = createStoreAPI(modules);
      storeReady = true;
      console.log(LOG_PREFIX, '✅ Store ready! Modules:', Object.keys(modules).join(', '));

      // Notify content script
      window.dispatchEvent(new CustomEvent('WStoreReady', { 
        detail: { modules: Object.keys(modules) } 
      }));
      return;
    }

    if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryInit, SCAN_INTERVAL);
    } else {
      console.warn(LOG_PREFIX, '❌ Could not find Store modules after', MAX_ATTEMPTS, 'attempts');
      // Expose a fallback store that reports unavailability
      window.WStore = {
        _ready: false,
        isReady() { return false; },
        async openChat() { return { success: false, error: 'Store not loaded' }; },
        getModules() { return []; },
      };
      window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { modules: [] } }));
    }
  }

  // Start scanning after a delay to let WhatsApp Web initialize
  if (document.readyState === 'complete') {
    setTimeout(tryInit, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(tryInit, 3000));
  }
})();
