import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const [validationState, setValidationState] = useState<PhoneValidationState>({});
  const isValidatingRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Get unique normalized phones
  const uniquePhones = useMemo(() => {
    const filtered = phones.filter((p): p is string => p !== null && p.length > 0);
    return [...new Set(filtered.map(normalizePhone))];
  }, [phones]);

  // Fetch cached validations from database
  const { data: cachedValidations = [] } = useQuery({
    queryKey: ['phone-validations', uniquePhones.join(',')],
    queryFn: async () => {
      if (uniquePhones.length === 0) return [];
      
      // Limit to 50 phones per query to avoid URL too long
      const phonesToQuery = uniquePhones.slice(0, 50);
      
      const { data, error } = await supabase
        .from('phone_validations')
        .select('normalized_phone, exists_on_whatsapp, jid, is_mobile')
        .in('normalized_phone', phonesToQuery);

      if (error) {
        console.error('[PhoneValidation] Error fetching cached:', error);
        return [];
      }

      return data || [];
    },
    enabled: uniquePhones.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create a set of already cached phones for quick lookup
  const cachedPhoneSet = useMemo(() => {
    return new Set(cachedValidations.map(v => v.normalized_phone));
  }, [cachedValidations]);

  // Update validation state from cached data
  useEffect(() => {
    if (cachedValidations.length === 0) return;

    setValidationState(prev => {
      const newState = { ...prev };
      
      cachedValidations.forEach(cached => {
        if (!newState[cached.normalized_phone]) {
          newState[cached.normalized_phone] = {
            status: cached.exists_on_whatsapp ? 'valid' : 'invalid',
            result: {
              exists: cached.exists_on_whatsapp,
              phone: cached.normalized_phone,
              isMobile: cached.is_mobile || false,
              jid: cached.jid || undefined,
            }
          };
        }
      });
      
      return newState;
    });
  }, [cachedValidations]);

  // Validate a single phone and save to database
  const validatePhone = useCallback(async (phone: string) => {
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
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'error', result: { exists: null, phone: normalizedPhone, isMobile: false, error: 'Erro na API' } }
        }));
        return;
      }

      if (data.error) {
        setValidationState(prev => ({
          ...prev,
          [normalizedPhone]: { status: 'error', result: data }
        }));
        return;
      }

      // Save to database for caching
      const { error: insertError } = await supabase
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

      if (insertError) {
        console.error('[PhoneValidation] Error saving to cache:', insertError);
      }

      // Update state
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

      // Invalidate cache to include new validation
      queryClient.invalidateQueries({ queryKey: ['phone-validations'] });
      
    } catch (err) {
      setValidationState(prev => ({
        ...prev,
        [normalizedPhone]: { status: 'error', result: { exists: null, phone: normalizedPhone, isMobile: false, error: 'Erro desconhecido' } }
      }));
    } finally {
      isValidatingRef.current.delete(normalizedPhone);
    }
  }, [cachedPhoneSet, queryClient]);

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
