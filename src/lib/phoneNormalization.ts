/**
 * Normalizes Brazilian phone numbers by removing non-digits and adding country code.
 * Does NOT force the 9th digit - preserves the original format.
 * 
 * This matches the database normalize_phone function.
 */
export function normalizePhoneForMatching(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length < 8) return null;
  
  // Add country code 55 if not present (10-11 digits means DDD + number)
  if (digits.length >= 10 && digits.length <= 11) {
    digits = '55' + digits;
  }
  
  // Remove leading zeros after country code
  if (digits.length > 4 && digits[2] === '0') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  return digits;
}

/**
 * Generates ALL possible variations of a Brazilian phone number.
 * This is the KEY function for matching - it generates every possible
 * format a number could be stored in the database.
 * 
 * Example: 89981340810 generates:
 * - 89981340810 (original)
 * - 5589981340810 (with country code, 13 digits)
 * - 8981340810 (without 9th digit, 10 digits)  
 * - 558981340810 (with country code, without 9th digit, 12 digits)
 */
export function generatePhoneVariations(phone: string | null | undefined): string[] {
  if (!phone) return [];
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length < 8) return [];
  
  const variations: Set<string> = new Set();
  
  // Add original
  variations.add(digits);
  
  // Remove country code if present to get base number
  let baseWithDDD = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    baseWithDDD = digits.slice(2);
  }
  
  // Now baseWithDDD should be DDD + number (10 or 11 digits)
  const ddd = baseWithDDD.slice(0, 2);
  const restOfNumber = baseWithDDD.slice(2);
  
  // Determine if we have 9th digit or not
  let with9: string;
  let without9: string;
  
  if (restOfNumber.length === 9 && restOfNumber[0] === '9') {
    // Has 9th digit
    with9 = restOfNumber;
    without9 = restOfNumber.slice(1);
  } else if (restOfNumber.length === 8) {
    // Without 9th digit
    without9 = restOfNumber;
    with9 = '9' + restOfNumber;
  } else {
    // Unknown format, just return what we have
    variations.add(baseWithDDD);
    variations.add('55' + baseWithDDD);
    return Array.from(variations);
  }
  
  // Generate all 4 main variations:
  // 1. DDD + 8 digits (without 9, without 55) - 10 digits
  variations.add(ddd + without9);
  
  // 2. DDD + 9 + 8 digits (with 9, without 55) - 11 digits
  variations.add(ddd + with9);
  
  // 3. 55 + DDD + 8 digits (without 9, with 55) - 12 digits
  variations.add('55' + ddd + without9);
  
  // 4. 55 + DDD + 9 + 8 digits (with 9, with 55) - 13 digits
  variations.add('55' + ddd + with9);
  
  return Array.from(variations);
}

/**
 * Checks if two phone numbers represent the same customer.
 * Compares all variations of both numbers.
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  if (!phone1 || !phone2) return false;
  
  const variations1 = new Set(generatePhoneVariations(phone1));
  const variations2 = generatePhoneVariations(phone2);
  
  // Check if any variation from phone2 exists in phone1's variations
  return variations2.some(v => variations1.has(v));
}

/**
 * Groups records by normalized phone number.
 * Records with different phone formats that represent the same number
 * will be grouped together.
 */
export function groupByNormalizedPhone<T extends { normalized_phone?: string | null }>(
  records: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const phoneToGroup = new Map<string, string>(); // Maps any variation to the group key
  
  for (const record of records) {
    if (!record.normalized_phone) continue;
    
    const variations = generatePhoneVariations(record.normalized_phone);
    
    // Check if any variation already has a group
    let existingGroupKey: string | undefined;
    for (const v of variations) {
      if (phoneToGroup.has(v)) {
        existingGroupKey = phoneToGroup.get(v);
        break;
      }
    }
    
    if (existingGroupKey) {
      // Add to existing group
      groups.get(existingGroupKey)!.push(record);
      // Map all variations to this group
      for (const v of variations) {
        phoneToGroup.set(v, existingGroupKey);
      }
    } else {
      // Create new group with the first variation as key
      const groupKey = record.normalized_phone;
      groups.set(groupKey, [record]);
      // Map all variations to this group
      for (const v of variations) {
        phoneToGroup.set(v, groupKey);
      }
    }
  }
  
  return groups;
}
