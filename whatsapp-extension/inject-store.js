// inject-store.js — Runs in MAIN world to access WhatsApp Web's webpack modules
// Uses moduleRaid-style discovery with cache + module map fallback

(function () {
  'use strict';

  const LOG = '[WStore]';
  const CHUNK_NAME = 'webpackChunkwhatsapp_web_client';
  const found = {};

  function getChunkArray() {
    if (Array.isArray(window[CHUNK_NAME])) return window[CHUNK_NAME];
    const alt = Object.keys(window).find((k) => k.startsWith('webpackChunk') && Array.isArray(window[k]));
    if (alt) {
      console.log(LOG, 'Using chunk array:', alt);
      return window[alt];
    }
    return null;
  }

  function moduleRaid() {
    const chunkArray = getChunkArray();
    if (!chunkArray) {
      console.warn(LOG, 'No webpack chunk array found');
      return false;
    }

    let wpRequire = null;
    try {
      chunkArray.push([
        ['__wstore_probe__'],
        {},
        function (require) {
          wpRequire = require;
        },
      ]);
    } catch (e) {
      console.warn(LOG, 'Chunk injection failed:', e.message);
      return false;
    }

    if (!wpRequire && typeof window.__webpack_require__ === 'function') {
      wpRequire = window.__webpack_require__;
      console.log(LOG, 'Recovered webpack require from window.__webpack_require__');
    }

    if (!wpRequire) {
      const runtimeChunk = chunkArray.find((chunk) => Array.isArray(chunk) && typeof chunk[2] === 'function');
      if (runtimeChunk) {
        try {
          runtimeChunk[2](function (require) {
            if (!wpRequire && require) wpRequire = require;
          });
        } catch (_) {}
      }
    }

    if (!wpRequire) {
      console.warn(LOG, 'No webpack require resolved');
      return false;
    }

    // Path A: module cache (best)
    if (wpRequire.c && typeof wpRequire.c === 'object' && Object.keys(wpRequire.c).length > 0) {
      scanFromCache(wpRequire.c);
    }

    // Path B: require.m fallback when cache is empty/hidden
    if ((!found.Chat || !found.Cmd) && wpRequire.m && typeof wpRequire.m === 'object') {
      scanFromModuleMap(wpRequire);
    }

    const ready = isStoreReady();
    console.log(LOG, 'Scanned modules. ready=', ready, 'found=', Object.keys(found));
    return ready;
  }

  function scanFromCache(cache) {
    for (const id in cache) {
      try {
        const exported = cache[id]?.exports;
        if (!exported) continue;
        scanExportTarget(exported);
      } catch (_) {}
    }
  }

  function scanFromModuleMap(requireFn) {
    const moduleIds = Object.keys(requireFn.m || {});
    for (const id of moduleIds) {
      try {
        const exported = requireFn(id);
        if (!exported) continue;
        scanExportTarget(exported);
      } catch (_) {}
    }
  }

  function scanExportTarget(exported) {
    const targets = [exported];
    if (exported?.default) targets.push(exported.default);

    if (exported && typeof exported === 'object') {
      for (const key of Object.keys(exported)) {
        if (key === 'default' || key === '__esModule') continue;
        targets.push(exported[key]);
      }
    }

    for (const target of targets) {
      if (!target || typeof target !== 'object') continue;
      matchModule(target);
      if (found.Chat && found.Cmd && found.WapQuery) return;
    }
  }

  function matchModule(obj) {
    try {
      // Chat
      if (!found.Chat) {
        if (typeof obj.findChat === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat via findChat');
        } else if (obj.Chat && typeof obj.Chat.find === 'function') {
          found.Chat = obj.Chat;
          console.log(LOG, '✓ Chat via Chat.find');
        } else if (typeof obj.find === 'function' && typeof obj.getModelsArray === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat via collection shape');
        }
      }

      // Cmd
      if (!found.Cmd) {
        if (typeof obj.openChatAt === 'function' || typeof obj.openChatBottom === 'function') {
          found.Cmd = obj;
          console.log(LOG, '✓ Cmd direct');
        } else if (obj.Cmd && (typeof obj.Cmd.openChatAt === 'function' || typeof obj.Cmd.openChatBottom === 'function')) {
          found.Cmd = obj.Cmd;
          console.log(LOG, '✓ Cmd via obj.Cmd');
        }
      }

      // WapQuery
      if (!found.WapQuery) {
        if (typeof obj.queryExists === 'function' || typeof obj.queryPhoneExists === 'function') {
          found.WapQuery = obj;
          console.log(LOG, '✓ WapQuery');
        }
      }

      // Generic nested scan fallback
      if (!found.Chat || !found.Cmd) {
        for (const key of Object.keys(obj)) {
          const nested = obj[key];
          if (!nested || typeof nested !== 'object') continue;
          if (!found.Chat && typeof nested.findChat === 'function') found.Chat = nested;
          if (!found.Chat && typeof nested.find === 'function' && typeof nested.getModelsArray === 'function') found.Chat = nested;
          if (!found.Cmd && (typeof nested.openChatAt === 'function' || typeof nested.openChatBottom === 'function')) found.Cmd = nested;
        }
      }
    } catch (_) {}
  }

  function isStoreReady() {
    return !!(found.Chat && found.Cmd);
  }

  function createStoreAPI() {
    return {
      _ready: isStoreReady(),

      async openChat(phone) {
        const jid = phone.includes('@') ? phone : `${phone}@c.us`;
        console.log(LOG, 'openChat', jid, 'modules=', Object.keys(found));

        // Method 1: Chat + Cmd
        if (found.Chat && found.Cmd) {
          try {
            const findFn = found.Chat.findChat || found.Chat.find;
            if (findFn) {
              const chat = await findFn.call(found.Chat, jid);
              if (chat) {
                const openFn = found.Cmd.openChatAt || found.Cmd.openChatBottom;
                if (openFn) {
                  openFn.call(found.Cmd, chat);
                  return { success: true, method: 'Chat+Cmd' };
                }
              }
            }
          } catch (e) {
            console.warn(LOG, 'Chat+Cmd failed:', e.message);
          }
        }

        // Method 2: WapQuery -> Chat -> Cmd
        if (found.WapQuery && found.Chat && found.Cmd) {
          try {
            const queryFn = found.WapQuery.queryExists || found.WapQuery.queryPhoneExists;
            if (queryFn) {
              const queryResult = await queryFn.call(found.WapQuery, jid);
              const wid = queryResult?.wid || queryResult?.id || queryResult;
              if (wid) {
                const findFn = found.Chat.findChat || found.Chat.find;
                const chat = await findFn.call(found.Chat, wid);
                if (chat) {
                  const openFn = found.Cmd.openChatAt || found.Cmd.openChatBottom;
                  openFn.call(found.Cmd, chat);
                  return { success: true, method: 'WapQuery+Chat+Cmd' };
                }
              }
            }
          } catch (e) {
            console.warn(LOG, 'WapQuery path failed:', e.message);
          }
        }

        return { success: false, error: 'Store methods exhausted' };
      },

      isReady() {
        return isStoreReady();
      },

      getModules() {
        return Object.keys(found);
      },
    };
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 30;
  const INTERVAL = 2000;

  function tryInit() {
    attempts += 1;
    console.log(LOG, `Attempt ${attempts}/${MAX_ATTEMPTS}`);

    const ok = moduleRaid();

    if (ok) {
      window.WStore = createStoreAPI();
      const modules = Object.keys(found);
      console.log(LOG, '✅ Ready', modules);
      window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { ready: true, modules } }));
      return;
    }

    if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryInit, INTERVAL);
      return;
    }

    console.warn(LOG, '❌ Failed after attempts');
    window.WStore = {
      _ready: false,
      isReady() {
        return false;
      },
      async openChat() {
        return { success: false, error: 'Store not loaded' };
      },
      getModules() {
        return [];
      },
    };

    window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { ready: false, modules: [] } }));
  }

  // content script bridge (isolated world -> main world)
  window.addEventListener('WStoreCall', async (event) => {
    const { callId, method, args } = event.detail || {};
    if (!callId || !method) return;

    let result = { success: false, error: 'Unknown method' };
    try {
      if (window.WStore && typeof window.WStore[method] === 'function') {
        result = await window.WStore[method](...(args || []));
      } else {
        result = { success: false, error: `WStore.${method} not available` };
      }
    } catch (error) {
      result = { success: false, error: error.message };
    }

    window.dispatchEvent(new CustomEvent('WStoreResponse', { detail: { callId, result } }));
  });

  if (document.readyState === 'complete') {
    setTimeout(tryInit, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(tryInit, 3000));
  }
})();
