// Local cache utility for storing data in localStorage with TTL

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

interface CacheStore<T> {
  [key: string]: CacheEntry<T>;
}

const PHONE_VALIDATION_CACHE_KEY = 'phone_validations_cache';
const RECOVERY_LOGS_CACHE_KEY = 'recovery_logs_cache';

// TTL in milliseconds
const PHONE_VALIDATION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RECOVERY_LOGS_TTL = 60 * 60 * 1000; // 1 hour

function getCache<T>(key: string): CacheStore<T> {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('[LocalCache] Error reading cache:', e);
  }
  return {};
}

function setCache<T>(key: string, store: CacheStore<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch (e) {
    console.error('[LocalCache] Error saving cache:', e);
  }
}

function isExpired(cachedAt: number, ttl: number): boolean {
  return Date.now() - cachedAt > ttl;
}

// Phone Validation Cache
export interface CachedPhoneValidation {
  exists: boolean | null;
  jid?: string;
  isMobile: boolean;
  error?: string;
}

export function getPhoneValidationsFromCache(): Record<string, CachedPhoneValidation> {
  const store = getCache<CachedPhoneValidation>(PHONE_VALIDATION_CACHE_KEY);
  const result: Record<string, CachedPhoneValidation> = {};
  
  for (const [phone, entry] of Object.entries(store)) {
    if (!isExpired(entry.cachedAt, PHONE_VALIDATION_TTL)) {
      result[phone] = entry.data;
    }
  }
  
  return result;
}

export function savePhoneValidationToCache(phone: string, validation: CachedPhoneValidation): void {
  const store = getCache<CachedPhoneValidation>(PHONE_VALIDATION_CACHE_KEY);
  store[phone] = {
    data: validation,
    cachedAt: Date.now(),
  };
  setCache(PHONE_VALIDATION_CACHE_KEY, store);
}

export function savePhoneValidationsToCache(validations: Record<string, CachedPhoneValidation>): void {
  const store = getCache<CachedPhoneValidation>(PHONE_VALIDATION_CACHE_KEY);
  const now = Date.now();
  
  for (const [phone, validation] of Object.entries(validations)) {
    store[phone] = {
      data: validation,
      cachedAt: now,
    };
  }
  
  setCache(PHONE_VALIDATION_CACHE_KEY, store);
}

// Recovery Logs Cache
export interface CachedRecoveryLog {
  status: 'sent' | 'failed' | 'pending';
  sentAt: string | null;
  errorMessage: string | null;
}

export function getRecoveryLogsFromCache(): Record<string, CachedRecoveryLog> {
  const store = getCache<CachedRecoveryLog>(RECOVERY_LOGS_CACHE_KEY);
  const result: Record<string, CachedRecoveryLog> = {};
  
  for (const [transactionId, entry] of Object.entries(store)) {
    if (!isExpired(entry.cachedAt, RECOVERY_LOGS_TTL)) {
      result[transactionId] = entry.data;
    }
  }
  
  return result;
}

export function saveRecoveryLogToCache(transactionId: string, log: CachedRecoveryLog): void {
  const store = getCache<CachedRecoveryLog>(RECOVERY_LOGS_CACHE_KEY);
  store[transactionId] = {
    data: log,
    cachedAt: Date.now(),
  };
  setCache(RECOVERY_LOGS_CACHE_KEY, store);
}

export function saveRecoveryLogsToCache(logs: Record<string, CachedRecoveryLog>): void {
  const store = getCache<CachedRecoveryLog>(RECOVERY_LOGS_CACHE_KEY);
  const now = Date.now();
  
  for (const [transactionId, log] of Object.entries(logs)) {
    store[transactionId] = {
      data: log,
      cachedAt: now,
    };
  }
  
  setCache(RECOVERY_LOGS_CACHE_KEY, store);
}

export function clearRecoveryLogFromCache(transactionId: string): void {
  const store = getCache<CachedRecoveryLog>(RECOVERY_LOGS_CACHE_KEY);
  delete store[transactionId];
  setCache(RECOVERY_LOGS_CACHE_KEY, store);
}
