/**
 * Normalizes Brazilian phone numbers to a canonical 13-digit format: 55 + DDD + 9 + 8 digits
 * This matches the database normalize_phone function for consistent matching.
 * 
 * Handles all common variations:
 * - With or without country code (+55, 55)
 * - With or without the 9th digit for mobile
 * - With or without formatting (spaces, dashes, parentheses)
 * 
 * Returns: 55 + DDD + 9 + 8 digits (13 digits total)
 * Example: 89981340810 -> 5589981340810
 */
export function normalizePhoneForMatching(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length < 8) return null;
  
  // Remove country code 55 if present
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Remove leading zeros
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  let ddd: string;
  let numberPart: string;
  
  // Now we should have DDD + number (10 or 11 digits)
  if (digits.length === 11 && digits[2] === '9') {
    // Already has 9th digit: DDD + 9 + 8 digits
    ddd = digits.slice(0, 2);
    numberPart = digits.slice(2);
  } else if (digits.length === 10) {
    // Missing 9th digit: DDD + 8 digits, add the 9
    ddd = digits.slice(0, 2);
    numberPart = '9' + digits.slice(2);
  } else if (digits.length === 11) {
    // 11 digits but 3rd is not 9
    ddd = digits.slice(0, 2);
    numberPart = digits.slice(2);
  } else {
    // Other formats, just add 55 prefix
    return '55' + digits;
  }
  
  return '55' + ddd + numberPart;
}

/**
 * Generates all possible normalized variations of a phone number for database lookup.
 * Since we now normalize to 13 digits consistently, we also include variations
 * for backwards compatibility with older data.
 */
export function generatePhoneVariations(phone: string | null | undefined): string[] {
  if (!phone) return [];
  
  // Get the canonical normalized form (13 digits)
  const normalized = normalizePhoneForMatching(phone);
  if (!normalized || normalized.length < 10) return [];
  
  const variations: Set<string> = new Set();
  
  // Original digits
  const originalDigits = phone.replace(/\D/g, '');
  variations.add(originalDigits);
  
  // Add normalized form (13 digits: 55 + DDD + 9 + 8)
  variations.add(normalized);
  
  // If 13 digits, also generate 12-digit version (without the 9) for backwards compatibility
  if (normalized.length === 13 && normalized[4] === '9') {
    const without9 = normalized.slice(0, 4) + normalized.slice(5);
    variations.add(without9);
    
    // Also without country code
    variations.add(normalized.slice(2)); // 11 digits: DDD + 9 + 8
    variations.add(without9.slice(2));   // 10 digits: DDD + 8
  }
  
  return Array.from(variations);
}

/**
 * Checks if two phone numbers represent the same customer.
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const norm1 = normalizePhoneForMatching(phone1);
  const norm2 = normalizePhoneForMatching(phone2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2;
}

/**
 * Groups records by normalized phone number.
 * Records with different phone formats that normalize to the same number
 * will be grouped together.
 */
export function groupByNormalizedPhone<T extends { normalized_phone?: string | null }>(
  records: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const record of records) {
    const normalized = normalizePhoneForMatching(record.normalized_phone);
    if (!normalized) continue;
    
    const existing = groups.get(normalized);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(normalized, [record]);
    }
  }
  
  return groups;
}
