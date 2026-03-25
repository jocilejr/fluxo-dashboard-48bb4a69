// inject-store.js — Runs in MAIN world to access WhatsApp Web's webpack modules
// Uses moduleRaid pattern for robust module discovery

(function () {
  'use strict';

  const LOG = '[WStore]';
  const CHUNK_NAME = 'webpackChunkwhatsapp_web_client';

  // Modules we want to find
  const found = {};

  // ============================================
  // MODULE RAID — capture webpack require
  // ============================================
  function moduleRaid() {
    const chunkArray = window[CHUNK_NAME];
    if (!chunkArray) {
      // Try alternative names
      const alt = Object.keys(window).find(k =>
        k.startsWith('webpackChunk') && Array.isArray(window[k])
      );
      if (alt) {
        console.log(LOG, 'Using alt chunk array:', alt);
        return raidFromChunks(window[alt]);
      }
      return false;
    }
    return raidFromChunks(chunkArray);
  }

  function raidFromChunks(chunkArray) {
    let wpRequire = null;

    try {
      chunkArray.push([
        ['__moduleRaid__'],
        {},
        function (require) { wpRequire = require; }
      ]);
    } catch (e) {
      console.warn(LOG, 'Chunk injection failed:', e.message);
      return false;
    }

    if (!wpRequire || !wpRequire.c) {
      console.warn(LOG, 'No require.c found');
      return false;
    }

    const cache = wpRequire.c;
    let scanned = 0;

    for (const id in cache) {
      try {
        const mod = cache[id];
        if (!mod?.exports) continue;
        scanned++;

        const exports = mod.exports;
        const targets = [exports];
        if (exports.default) targets.push(exports.default);
        if (exports.__esModule && typeof exports === 'object') {
          for (const key of Object.keys(exports)) {
            if (key !== 'default' && key !== '__esModule' && exports[key]) {
              targets.push(exports[key]);
            }
          }
        }

        for (const t of targets) {
          if (!t || typeof t !== 'object') continue;
          matchModule(t);
        }
      } catch (_) {}
    }

    console.log(LOG, `Scanned ${scanned} modules, found:`, Object.keys(found).join(', ') || 'none');
    return Object.keys(found).length > 0;
  }

  function matchModule(obj) {
    try {
      // Chat store
      if (!found.Chat) {
        if (typeof obj.findChat === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat (findChat)');
        } else if (obj.Chat && typeof obj.Chat.find === 'function') {
          found.Chat = obj.Chat;
          console.log(LOG, '✓ Chat (Chat.find)');
        } else if (typeof obj.find === 'function' && typeof obj.getModelsArray === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat (find+getModelsArray)');
        }
      }

      // Cmd store
      if (!found.Cmd) {
        if (typeof obj.openChatAt === 'function') {
          found.Cmd = obj;
          console.log(LOG, '✓ Cmd (openChatAt)');
        } else if (typeof obj.openChatBottom === 'function') {
          found.Cmd = obj;
          console.log(LOG, '✓ Cmd (openChatBottom)');
        } else if (obj.Cmd && typeof obj.Cmd.openChatAt === 'function') {
          found.Cmd = obj.Cmd;
          console.log(LOG, '✓ Cmd (Cmd.openChatAt)');
        }
      }

      // WapQuery
      if (!found.WapQuery) {
        if (typeof obj.queryExists === 'function') {
          found.WapQuery = obj;
          console.log(LOG, '✓ WapQuery (queryExists)');
        } else if (typeof obj.queryPhoneExists === 'function') {
          found.WapQuery = obj;
          console.log(LOG, '✓ WapQuery (queryPhoneExists)');
        }
      }

      // Contact store
      if (!found.Contact) {
        if (obj.Contact && typeof obj.Contact.find === 'function') {
          found.Contact = obj.Contact;
        } else if (typeof obj.getContact === 'function') {
          found.Contact = obj;
        }
      }

      // Generic scan: look for known function names in any export
      if (!found.Chat || !found.Cmd) {
        for (const key of Object.keys(obj)) {
          try {
            const val = obj[key];
            if (!val || typeof val !== 'object') continue;
            if (!found.Chat && typeof val.find === 'function' && typeof val.findChat === 'function') {
              found.Chat = val;
              console.log(LOG, '✓ Chat (generic scan via', key, ')');
            }
            if (!found.Cmd && typeof val.openChatAt === 'function') {
              found.Cmd = val;
              console.log(LOG, '✓ Cmd (generic scan via', key, ')');
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // ============================================
  // STORE API
  // ============================================
  function createStoreAPI() {
    return {
      _ready: Object.keys(found).length > 0,

      async openChat(phone) {
        const jid = phone.includes('@') ? phone : `${phone}@c.us`;
        console.log(LOG, 'openChat:', jid, 'modules:', Object.keys(found));

        // Method 1: Chat.find/findChat + Cmd.openChatAt
        if (found.Chat) {
          try {
            const findFn = found.Chat.findChat || found.Chat.find;
            if (findFn) {
              const chat = await findFn.call(found.Chat, jid);
              if (chat) {
                if (found.Cmd) {
                  const openFn = found.Cmd.openChatAt || found.Cmd.openChatBottom;
                  if (openFn) {
                    openFn.call(found.Cmd, chat);
                    return { success: true, method: 'Chat+Cmd' };
                  }
                }
                // Even without Cmd, if we found the chat we can try dispatching
                return { success: true, method: 'Chat.find (no Cmd)', partial: true };
              }
            }
          } catch (e) {
            console.warn(LOG, 'Chat.find failed:', e.message);
          }
        }

        // Method 2: WapQuery.queryExists
        if (found.WapQuery) {
          try {
            const qFn = found.WapQuery.queryExists || found.WapQuery.queryPhoneExists;
            if (qFn) {
              const result = await qFn.call(found.WapQuery, jid);
              if (result?.wid && found.Chat) {
                const findFn = found.Chat.findChat || found.Chat.find;
                const chat = await findFn.call(found.Chat, result.wid);
                if (chat && found.Cmd) {
                  const openFn = found.Cmd.openChatAt || found.Cmd.openChatBottom;
                  if (openFn) {
                    openFn.call(found.Cmd, chat);
                    return { success: true, method: 'WapQuery+Chat+Cmd' };
                  }
                }
              }
            }
          } catch (e) {
            console.warn(LOG, 'WapQuery failed:', e.message);
          }
        }

        return { success: false, error: 'Store methods exhausted' };
      },

      isReady() { return this._ready; },
      getModules() { return Object.keys(found); },
    };
  }

  // ============================================
  // INIT with retries
  // ============================================
  let attempts = 0;
  const MAX = 30;
  const INTERVAL = 2000;

  function tryInit() {
    attempts++;
    console.log(LOG, `Attempt ${attempts}/${MAX}`);

    const success = moduleRaid();

    if (success) {
      window.WStore = createStoreAPI();
      console.log(LOG, '✅ Ready:', Object.keys(found).join(', '));
      window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { modules: Object.keys(found) } }));
      return;
    }

    if (attempts < MAX) {
      setTimeout(tryInit, INTERVAL);
    } else {
      console.warn(LOG, '❌ Failed after', MAX, 'attempts');
      window.WStore = {
        _ready: false,
        isReady() { return false; },
        async openChat() { return { success: false, error: 'Store not loaded' }; },
        getModules() { return []; },
      };
      window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { modules: [] } }));
    }
  }

  // Bridge: content script → MAIN world
  window.addEventListener('WStoreCall', async (e) => {
    const { callId, method, args } = e.detail || {};
    if (!callId || !method) return;

    let result = { success: false, error: 'Unknown method' };
    try {
      if (window.WStore && typeof window.WStore[method] === 'function') {
        result = await window.WStore[method](...(args || []));
      } else {
        result = { success: false, error: `WStore.${method} not available` };
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    window.dispatchEvent(new CustomEvent('WStoreResponse', { detail: { callId, result } }));
  });

  // Start after WhatsApp loads
  if (document.readyState === 'complete') {
    setTimeout(tryInit, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(tryInit, 3000));
  }
})();
