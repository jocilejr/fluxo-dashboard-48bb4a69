import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  getPhoneValidationsFromCache, 
  savePhoneValidationToCache,
  savePhoneValidationsToCache,
  CachedPhoneValidation 
} from "@/lib/localCache";

// Check if Evolution API is active before validating
function useEvolutionApiActive() {
  const { data: isActive = false } = useQuery({
    queryKey: ['evolution-api-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('evolution_api_settings')
        .select('is_active')
        .limit(1)
        .single();
      return data?.is_active ?? false;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
  return isActive;
}

interface ValidationResult {
  exists: boolean | null;
  phone: string;
  isMobile: boolean;
  jid?: string;
  error?: string;
}

interface PhoneValidationState {
  [phone: string]: {
    status: 'pending' | 'valid' | 'invalid' | 'error';
    result?: ValidationResult;
  };
}

// Normalize phone for consistent lookup
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function usePhoneValidation(phones: (string | null)[]) {
  const isEvolutionActive = useEvolutionApiActive();
  const [validationState, setValidationState] = useState<PhoneValidationState>(() => {
    // Initialize from localStorage cache immediately
    const cachedValidations = getPhoneValidationsFromCache();
    const initialState: PhoneValidationState = {};
    
    for (const [phone, cached] of Object.entries(cachedValidations)) {
      if (cached.exists === true) {
        initialState[phone] = { status: 'valid', result: { exists: true, phone, isMobile: cached.isMobile, jid: cached.jid } };
      } else if (cached.exists === false) {
        initialState[phone] = { status: 'invalid', result: { exists: false, phone, isMobile: cached.isMobile } };
      } else if (cached.error) {
        initialState[phone] = { status: 'error', result: { exists: null, phone, isMobile: false, error: cached.error } };
      }
    }
    
    return initialState;
  });
  
  const isValidatingRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Get unique normalized phones
  const uniquePhones = useMemo(() => {
    const filtered = phones.filter((p): p is string => p !== null && p.length > 0);
    return [...new Set(filtered.map(normalizePhone))];
  }, [phones]);

  // Get phones not in local cache
  const phonesNotInLocalCache = useMemo(() => {
    return uniquePhones.filter(p => !validationState[p]);
  }, [uniquePhones, validationState]);

  // Fetch cached validations from database only for phones not in local cache
  const { data: dbValidations = [] } = useQuery({
    queryKey: ['phone-validations-db', phonesNotInLocalCache.join(',')],
    queryFn: async () => {
      if (phonesNotInLocalCache.length === 0) return [];
      
      // Limit to 50 phones per query
      const phonesToQuery = phonesNotInLocalCache.slice(0, 50);
      
      const { data, error } = await supabase
        .from('phone_validations')
        .select('normalized_phone, exists_on_whatsapp, jid, is_mobile')
        .in('normalized_phone', phonesToQuery);

      if (error) {
        return [];
      }

      return data || [];
    },
    enabled: phonesNotInLocalCache.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Create a set of already cached phones (local + db) for quick lookup
  const cachedPhoneSet = useMemo(() => {
    const set = new Set(Object.keys(validationState));
    dbValidations.forEach(v => set.add(v.normalized_phone));
    return set;
  }, [validationState, dbValidations]);

  // Update validation state from database data and save to local cache
  useEffect(() => {
    if (dbValidations.length === 0) return;

    const newLocalCache: Record<string, CachedPhoneValidation> = {};

    setValidationState(prev => {
      const newState = { ...prev };
      
      dbValidations.forEach(cached => {
        if (!newState[cached.normalized_phone]) {
          const status = cached.exists_on_whatsapp ? 'valid' : 'invalid';
          newState[cached.normalized_phone] = {
            status,
            result: {
              exists: cached.exists_on_whatsapp,
              phone: cached.normalized_phone,
              isMobile: cached.is_mobile || false,
              jid: cached.jid || undefined,
            }
          };
          
          // Prepare for local cache
          newLocalCache[cached.normalized_phone] = {
            exists: cached.exists_on_whatsapp,
            jid: cached.jid || undefined,
            isMobile: cached.is_mobile || false,
          };
        }
      });
      
      return newState;
    });

    // Save to local cache
    if (Object.keys(newLocalCache).length > 0) {
      savePhoneValidationsToCache(newLocalCache);
    }
  }, [dbValidations]);

  // Validate a single phone and save to both database and local cache
  const validatePhone = useCallback(async (phone: string) => {
    if (!isEvolutionActive) return;
    const normalizedPhone = normalizePhone(phone);
    
    // Skip if already cached or currently validating
    if (cachedPhoneSet.has(normalizedPhone) || isValidatingRef.current.has(normalizedPhone)) {
      return;
    }

    isValidatingRef.current.add(normalizedPhone);
    setValidationState(prev => ({
      ...prev,
      [normalizedPhone]: { status: 'pending' }
    }));

    try {
      const { data, error } = await supabase.functions.invoke('evolution-validate-number', {
        body: { phone: normalizedPhone }
      });

      if (error) {
        const errorResult: CachedPhoneValidation = { exists: null, isMobile: false, error: 'Erro na API' };
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'error', result: { exists: null, phone: normalizedPhone, isMobile: false, error: 'Erro na API' } }
        }));
        savePhoneValidationToCache(normalizedPhone, errorResult);
        return;
      }

      if (data.error) {
        const errorResult: CachedPhoneValidation = { exists: null, isMobile: false, error: data.error };
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'error', result: data }
        }));
        savePhoneValidationToCache(normalizedPhone, errorResult);
        return;
      }

      // Save to database for persistence
      await supabase
        .from('phone_validations')
        .upsert({
          normalized_phone: normalizedPhone,
          exists_on_whatsapp: data.exists === true,
          jid: data.jid || null,
          is_mobile: data.isMobile || false,
          validated_at: new Date().toISOString(),
        }, {
          onConflict: 'normalized_phone'
        });

      // Update state and local cache
      const cachedResult: CachedPhoneValidation = {
        exists: data.exists === true,
        jid: data.jid || undefined,
        isMobile: data.isMobile || false,
      };

      if (data.exists === true) {
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'valid', result: data }
        }));
      } else {
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'invalid', result: data }
        }));
      }

      // Save to local cache
      savePhoneValidationToCache(normalizedPhone, cachedResult);
      
    } catch (err) {
      const errorResult: CachedPhoneValidation = { exists: null, isMobile: false, error: 'Erro desconhecido' };
      setValidationState(prev => ({
        ...prev,
        [normalizedPhone]: { status: 'error', result: { exists: null, phone: normalizedPhone, isMobile: false, error: 'Erro desconhecido' } }
      }));
      savePhoneValidationToCache(normalizedPhone, errorResult);
    } finally {
      isValidatingRef.current.delete(normalizedPhone);
    }
  }, [cachedPhoneSet, isEvolutionActive]);

  // Validate phones that are not cached yet
  useEffect(() => {
    const phonesToValidate = uniquePhones.filter(p => 
      !cachedPhoneSet.has(p) && 
      !isValidatingRef.current.has(p) &&
      !validationState[p]
    );
    
    // Limit validations and add delay between each
    phonesToValidate.slice(0, 10).forEach((phone, index) => {
      setTimeout(() => {
        validatePhone(phone);
      }, index * 500);
    });
  }, [uniquePhones, cachedPhoneSet, validationState, validatePhone]);

  const getValidationStatus = useCallback((phone: string | null) => {
    if (!phone) return null;
    const normalizedPhone = normalizePhone(phone);
    return validationState[normalizedPhone] || null;
  }, [validationState]);

  return { getValidationStatus };
}
