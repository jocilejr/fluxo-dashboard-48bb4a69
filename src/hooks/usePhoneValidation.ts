import { useState, useEffect, useCallback, useRef } from "react";
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

export function usePhoneValidation(phones: (string | null)[]) {
  const [validationState, setValidationState] = useState<PhoneValidationState>({});
  const validatedPhonesRef = useRef<Set<string>>(new Set());
  const isValidatingRef = useRef<Set<string>>(new Set());

  const validatePhone = useCallback(async (phone: string) => {
    // Skip if already validated or currently validating
    if (validatedPhonesRef.current.has(phone) || isValidatingRef.current.has(phone)) {
      return;
    }

    isValidatingRef.current.add(phone);
    setValidationState(prev => ({
      ...prev,
      [phone]: { status: 'pending' }
    }));

    try {
      const { data, error } = await supabase.functions.invoke('evolution-validate-number', {
        body: { phone }
      });

      if (error) {
        setValidationState(prev => ({
          ...prev,
          [phone]: { status: 'error', result: { exists: null, phone, isMobile: false, error: 'Erro na API' } }
        }));
      } else if (data.error) {
        setValidationState(prev => ({
          ...prev,
          [phone]: { status: 'error', result: data }
        }));
      } else if (data.exists === true) {
        setValidationState(prev => ({
          ...prev,
          [phone]: { status: 'valid', result: data }
        }));
      } else {
        setValidationState(prev => ({
          ...prev,
          [phone]: { status: 'invalid', result: data }
        }));
      }
      
      validatedPhonesRef.current.add(phone);
    } catch (err) {
      setValidationState(prev => ({
        ...prev,
        [phone]: { status: 'error', result: { exists: null, phone, isMobile: false, error: 'Erro desconhecido' } }
      }));
    } finally {
      isValidatingRef.current.delete(phone);
    }
  }, []);

  useEffect(() => {
    // Filter unique, non-null phones that haven't been validated yet
    const uniquePhones = [...new Set(phones.filter((p): p is string => p !== null))];
    const phonesToValidate = uniquePhones.filter(p => !validatedPhonesRef.current.has(p) && !isValidatingRef.current.has(p));
    
    // Validate phones with a small delay between each to avoid overwhelming the API
    phonesToValidate.forEach((phone, index) => {
      setTimeout(() => {
        validatePhone(phone);
      }, index * 500); // 500ms delay between each validation
    });
  }, [phones, validatePhone]);

  const getValidationStatus = useCallback((phone: string | null) => {
    if (!phone) return null;
    return validationState[phone] || null;
  }, [validationState]);

  return { getValidationStatus };
}
