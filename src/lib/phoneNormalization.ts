/**
 * Normalizes Brazilian phone numbers to a canonical format for matching purposes.
 * Handles all common variations:
 * - With or without country code (+55, 55)
 * - With or without the 9th digit for mobile
 * - With or without formatting (spaces, dashes, parentheses)
 * 
 * Returns the MINIMAL form: DDD + 8 digits (without the 9)
 * This allows matching: 89981340810, 5589981340810, +55 89 9 8134-0810, 8981340810
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
  
  // Now we should have DDD + number (10 or 11 digits)
  // If 11 digits and the 3rd digit is 9, it's the mobile 9th digit - remove it
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  // If still 11 digits (old format or different pattern), try removing leading 9 after DDD
  if (digits.length === 11) {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  // If 10 digits, we have DDD + 8 digit number (normalized)
  // If 9 digits, might be missing DDD - keep as is
  // If 8 digits, it's just the number without DDD - keep as is
  
  return digits;
}

/**
 * Generates all possible normalized variations of a phone number for database lookup.
 * This allows matching a customer record regardless of which format was stored.
 */
export function generatePhoneVariations(phone: string | null | undefined): string[] {
  if (!phone) return [];
  
  // Get the minimal normalized form
  const normalized = normalizePhoneForMatching(phone);
  if (!normalized || normalized.length < 8) return [];
  
  const variations: Set<string> = new Set();
  
  // Original digits
  const originalDigits = phone.replace(/\D/g, '');
  variations.add(originalDigits);
  
  // Add normalized form
  variations.add(normalized);
  
  // If we have DDD + 8 digits, also generate with the 9th digit
  if (normalized.length === 10) {
    const ddd = normalized.slice(0, 2);
    const number = normalized.slice(2);
    
    // With 9th digit
    const with9 = ddd + '9' + number;
    variations.add(with9);
    
    // With country code
    variations.add('55' + normalized);
    variations.add('55' + with9);
  }
  
  // If 11 digits (with 9th digit), also generate without
  if (normalized.length === 11 && normalized[2] === '9') {
    const without9 = normalized.slice(0, 2) + normalized.slice(3);
    variations.add(without9);
    variations.add('55' + without9);
    variations.add('55' + normalized);
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
