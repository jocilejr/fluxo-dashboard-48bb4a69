// inject-store.js — Runs in MAIN world to access WhatsApp Web's webpack modules
// Robust moduleRaid with cascading require resolution and named module discovery

(function () {
  'use strict';

  const LOG = '[WStore]';
  const found = {};

  // ============================================
  // 1. Webpack Require Resolution (cascading)
  // ============================================
  function resolveWebpackRequire() {
    const strategies = [
      resolveViaChunkInjection,
      resolveViaGlobalRequire,
      resolveViaRuntimeChunk,
      resolveViaWebpackJsonp,
    ];

    for (const strategy of strategies) {
      try {
        const req = strategy();
        if (req && typeof req === 'function') {
          console.log(LOG, '✓ Require resolved via', strategy.name);
          return req;
        }
      } catch (e) {
        console.warn(LOG, strategy.name, 'failed:', e.message);
      }
    }

    console.warn(LOG, 'All require resolution strategies failed');
    return null;
  }

  function getChunkArray() {
    // Try known name first
    if (Array.isArray(window.webpackChunkwhatsapp_web_client)) {
      return window.webpackChunkwhatsapp_web_client;
    }
    // Fallback: any webpackChunk array
    for (const key of Object.keys(window)) {
      if (key.startsWith('webpackChunk') && Array.isArray(window[key])) {
        console.log(LOG, 'Using chunk array:', key);
        return window[key];
      }
    }
    return null;
  }

  function resolveViaChunkInjection() {
    const chunkArray = getChunkArray();
    if (!chunkArray) return null;

    let wpRequire = null;
    const probeId = '__wstore_probe_' + Date.now();

    try {
      chunkArray.push([
        [probeId],
        {},
        function (require) {
          wpRequire = require;
        },
      ]);
    } catch (_) {}

    return wpRequire;
  }

  function resolveViaGlobalRequire() {
    if (typeof window.__webpack_require__ === 'function') {
      return window.__webpack_require__;
    }
    // Some builds expose it differently
    for (const key of ['__webpack_require__', 'webpackRequire', '__r']) {
      if (typeof window[key] === 'function') return window[key];
    }
    return null;
  }

  function resolveViaRuntimeChunk() {
    const chunkArray = getChunkArray();
    if (!chunkArray) return null;

    let wpRequire = null;
    for (const chunk of chunkArray) {
      if (Array.isArray(chunk) && typeof chunk[2] === 'function') {
        try {
          chunk[2](function (req) {
            if (!wpRequire && req && typeof req === 'function') wpRequire = req;
          });
          if (wpRequire) break;
        } catch (_) {}
      }
    }
    return wpRequire;
  }

  function resolveViaWebpackJsonp() {
    // Legacy pattern
    if (window.webpackJsonp && Array.isArray(window.webpackJsonp)) {
      let wpRequire = null;
      try {
        window.webpackJsonp.push([
          ['__wstore_jsonp_probe__'],
          { '__wstore_jsonp_probe__': function (m, e, r) { wpRequire = r; } },
          [['__wstore_jsonp_probe__']],
        ]);
      } catch (_) {}
      return wpRequire;
    }
    return null;
  }

  // ============================================
  // 2. Module Scanning
  // ============================================
  function scanModules(wpRequire) {
    // Path A: module cache
    if (wpRequire.c && typeof wpRequire.c === 'object') {
      const cacheSize = Object.keys(wpRequire.c).length;
      console.log(LOG, 'Scanning cache with', cacheSize, 'modules');
      if (cacheSize > 0) {
        scanFromCache(wpRequire.c);
      }
    }

    // Path B: module map (require each module)
    if (!isMinimalReady() && wpRequire.m && typeof wpRequire.m === 'object') {
      const mapSize = Object.keys(wpRequire.m).length;
      console.log(LOG, 'Scanning module map with', mapSize, 'factories');
      scanFromModuleMap(wpRequire);
    }
  }

  function scanFromCache(cache) {
    for (const id in cache) {
      try {
        const mod = cache[id];
        if (!mod?.exports) continue;
        scanExports(mod.exports, id);
        if (isFullReady()) return;
      } catch (_) {}
    }
  }

  function scanFromModuleMap(requireFn) {
    const ids = Object.keys(requireFn.m || {});
    let scanned = 0;
    for (const id of ids) {
      try {
        const exported = requireFn(id);
        if (!exported) continue;
        scanExports(exported, id);
        scanned++;
        if (isFullReady()) return;
      } catch (_) {}
    }
    console.log(LOG, 'Module map: scanned', scanned, 'of', ids.length);
  }

  function scanExports(exported, moduleId) {
    const targets = new Set();
    targets.add(exported);
    if (exported?.default) targets.add(exported.default);

    if (exported && typeof exported === 'object') {
      for (const key of Object.keys(exported)) {
        if (key === '__esModule') continue;
        const val = exported[key];
        if (val && typeof val === 'object') targets.add(val);
        if (val && typeof val === 'function') targets.add(val);
      }
    }

    for (const target of targets) {
      if (!target) continue;
      matchModulePatterns(target, moduleId);
    }
  }

  // ============================================
  // 3. Module Pattern Matching
  // ============================================
  function matchModulePatterns(obj, moduleId) {
    if (typeof obj !== 'object' && typeof obj !== 'function') return;

    try {
      // --- WidFactory ---
      if (!found.WidFactory) {
        if (typeof obj.createWid === 'function' || typeof obj.createWidFromWidLike === 'function') {
          found.WidFactory = obj;
          console.log(LOG, '✓ WidFactory (module:', moduleId, ')');
        } else if (typeof obj.createUserWid === 'function') {
          found.WidFactory = obj;
          console.log(LOG, '✓ WidFactory via createUserWid');
        }
      }

      // --- Chat (collection/store) ---
      if (!found.Chat) {
        if (typeof obj.findChat === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat via findChat');
        } else if (typeof obj.find === 'function' && typeof obj.getModelsArray === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat via collection shape');
        } else if (obj.Chat && typeof obj.Chat.find === 'function') {
          found.Chat = obj.Chat;
          console.log(LOG, '✓ Chat via obj.Chat');
        } else if (typeof obj.get === 'function' && typeof obj.find === 'function' && typeof obj.serialize === 'function') {
          found.Chat = obj;
          console.log(LOG, '✓ Chat via get+find+serialize');
        }
      }

      // --- FindChat (action) ---
      if (!found.FindChat) {
        if (typeof obj.findOrCreateLatestChat === 'function') {
          found.FindChat = obj;
          console.log(LOG, '✓ FindChat via findOrCreateLatestChat');
        } else if (typeof obj.findChatAction === 'function') {
          found.FindChat = obj;
          console.log(LOG, '✓ FindChat via findChatAction');
        }
      }

      // --- Cmd ---
      if (!found.Cmd) {
        if (typeof obj.openChatAt === 'function' || typeof obj.openChatBottom === 'function') {
          found.Cmd = obj;
          console.log(LOG, '✓ Cmd direct');
        } else if (obj.Cmd && (typeof obj.Cmd.openChatAt === 'function' || typeof obj.Cmd.openChatBottom === 'function')) {
          found.Cmd = obj.Cmd;
          console.log(LOG, '✓ Cmd via obj.Cmd');
        }
      }

      // --- WapQuery ---
      if (!found.WapQuery) {
        if (typeof obj.queryExists === 'function' || typeof obj.queryPhoneExists === 'function') {
          found.WapQuery = obj;
          console.log(LOG, '✓ WapQuery');
        }
      }

      // --- ContactCollection ---
      if (!found.Contact) {
        if (typeof obj.getContact === 'function') {
          found.Contact = obj;
          console.log(LOG, '✓ Contact via getContact');
        } else if (obj.Contact && typeof obj.Contact.find === 'function') {
          found.Contact = obj.Contact;
          console.log(LOG, '✓ Contact via obj.Contact');
        }
      }

      // --- Generic nested scan ---
      if (!isMinimalReady() && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          try {
            const nested = obj[key];
            if (!nested || typeof nested !== 'object') continue;
            if (!found.Chat && typeof nested.findChat === 'function') { found.Chat = nested; console.log(LOG, '✓ Chat nested via', key); }
            if (!found.Chat && typeof nested.find === 'function' && typeof nested.getModelsArray === 'function') { found.Chat = nested; console.log(LOG, '✓ Chat nested collection via', key); }
            if (!found.Cmd && (typeof nested.openChatAt === 'function' || typeof nested.openChatBottom === 'function')) { found.Cmd = nested; console.log(LOG, '✓ Cmd nested via', key); }
            if (!found.FindChat && typeof nested.findOrCreateLatestChat === 'function') { found.FindChat = nested; console.log(LOG, '✓ FindChat nested via', key); }
            if (!found.WidFactory && typeof nested.createWid === 'function') { found.WidFactory = nested; console.log(LOG, '✓ WidFactory nested via', key); }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function isMinimalReady() {
    // Minimal: need at least Chat+Cmd OR FindChat
    return !!(found.Chat && found.Cmd) || !!found.FindChat;
  }

  function isFullReady() {
    return !!(found.Chat && found.Cmd);
  }

  // ============================================
  // 4. WID Creation
  // ============================================
  function createWid(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const jid = cleaned.includes('@') ? cleaned : `${cleaned}@c.us`;

    // Try WidFactory first
    if (found.WidFactory) {
      try {
        if (typeof found.WidFactory.createWid === 'function') {
          return found.WidFactory.createWid(jid);
        }
        if (typeof found.WidFactory.createWidFromWidLike === 'function') {
          return found.WidFactory.createWidFromWidLike({ server: 'c.us', user: cleaned, _serialized: jid });
        }
        if (typeof found.WidFactory.createUserWid === 'function') {
          return found.WidFactory.createUserWid(cleaned);
        }
      } catch (e) {
        console.warn(LOG, 'WidFactory failed:', e.message);
      }
    }

    // Fallback: plain object WID
    return { server: 'c.us', user: cleaned, _serialized: jid };
  }

  // ============================================
  // 5. Store API
  // ============================================
  function createStoreAPI() {
    return {
      _ready: isMinimalReady(),

      async openChat(phone) {
        const wid = createWid(phone);
        const jid = typeof wid === 'string' ? wid : (wid._serialized || `${phone}@c.us`);
        console.log(LOG, 'openChat', jid, 'modules=', Object.keys(found));

        // Method 1: findOrCreateLatestChat (most reliable when available)
        if (found.FindChat) {
          try {
            const chat = await found.FindChat.findOrCreateLatestChat(wid);
            if (chat) {
              if (found.Cmd) {
                const openFn = found.Cmd.openChatBottom || found.Cmd.openChatAt;
                if (openFn) {
                  openFn.call(found.Cmd, chat);
                  return { success: true, method: 'store-findOrCreateLatestChat' };
                }
              }
              // Chat found but no Cmd — try chat.open if available
              if (typeof chat.open === 'function') {
                await chat.open();
                return { success: true, method: 'store-chat.open' };
              }
            }
          } catch (e) {
            console.warn(LOG, 'findOrCreateLatestChat failed:', e.message);
          }
        }

        // Method 2: Chat.find/findChat + Cmd
        if (found.Chat && found.Cmd) {
          try {
            const findFn = found.Chat.findChat || found.Chat.find;
            if (findFn) {
              const chat = await findFn.call(found.Chat, wid);
              if (chat) {
                const openFn = found.Cmd.openChatBottom || found.Cmd.openChatAt;
                if (openFn) {
                  openFn.call(found.Cmd, chat);
                  return { success: true, method: 'store-Chat+Cmd' };
                }
              }
            }
          } catch (e) {
            console.warn(LOG, 'Chat+Cmd failed:', e.message);
          }
        }

        // Method 3: Chat.get (synchronous collection lookup) + Cmd
        if (found.Chat && found.Cmd && typeof found.Chat.get === 'function') {
          try {
            const chat = found.Chat.get(wid) || found.Chat.get(jid);
            if (chat) {
              const openFn = found.Cmd.openChatBottom || found.Cmd.openChatAt;
              if (openFn) {
                openFn.call(found.Cmd, chat);
                return { success: true, method: 'store-Chat.get+Cmd' };
              }
            }
          } catch (e) {
            console.warn(LOG, 'Chat.get+Cmd failed:', e.message);
          }
        }

        // Method 4: WapQuery -> Chat -> Cmd
        if (found.WapQuery && found.Chat && found.Cmd) {
          try {
            const queryFn = found.WapQuery.queryExists || found.WapQuery.queryPhoneExists;
            if (queryFn) {
              const queryResult = await queryFn.call(found.WapQuery, jid);
              const resultWid = queryResult?.wid || queryResult?.id || queryResult;
              if (resultWid) {
                const findFn = found.Chat.findChat || found.Chat.find;
                if (findFn) {
                  const chat = await findFn.call(found.Chat, resultWid);
                  if (chat) {
                    const openFn = found.Cmd.openChatBottom || found.Cmd.openChatAt;
                    if (openFn) {
                      openFn.call(found.Cmd, chat);
                      return { success: true, method: 'store-WapQuery+Chat+Cmd' };
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn(LOG, 'WapQuery path failed:', e.message);
          }
        }

        return { success: false, error: 'store_methods_exhausted' };
      },

      isReady() {
        return isMinimalReady();
      },

      getModules() {
        return Object.keys(found);
      },
    };
  }

  // ============================================
  // 6. Bootstrap with retries
  // ============================================
  let attempts = 0;
  const MAX_ATTEMPTS = 40;
  const INTERVAL = 2000;

  function tryInit() {
    attempts += 1;
    console.log(LOG, `Attempt ${attempts}/${MAX_ATTEMPTS}`);

    const wpRequire = resolveWebpackRequire();
    if (wpRequire) {
      scanModules(wpRequire);
    }

    if (isMinimalReady()) {
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

    console.warn(LOG, '❌ Failed after', MAX_ATTEMPTS, 'attempts. Found:', Object.keys(found));
    window.WStore = createStoreAPI(); // Expose what we have (even if incomplete)
    window.dispatchEvent(new CustomEvent('WStoreReady', { detail: { ready: false, modules: Object.keys(found) } }));
  }

  // ============================================
  // 7. Content script bridge
  // ============================================
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

  // Start after page loads
  if (document.readyState === 'complete') {
    setTimeout(tryInit, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(tryInit, 3000));
  }
})();
