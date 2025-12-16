
-- Migration to merge duplicate customers (12 vs 13 digit phone variations)
-- This identifies duplicates and merges them into a single customer record

DO $$
DECLARE
  dup_record RECORD;
  keep_id uuid;
  delete_id uuid;
  keep_phone text;
  delete_phone text;
  merged_count int := 0;
BEGIN
  -- Find all duplicate pairs where one is 12 digits and another is 13 digits (same base number)
  FOR dup_record IN 
    SELECT 
      c1.id as id1,
      c1.normalized_phone as phone1,
      c2.id as id2,
      c2.normalized_phone as phone2,
      c1.total_transactions as trans1,
      c2.total_transactions as trans2,
      c1.created_at as created1,
      c2.created_at as created2
    FROM customers c1
    JOIN customers c2 ON c1.id < c2.id  -- Prevent duplicate pairs
    WHERE 
      -- Match 12-digit with 13-digit (9th digit variation)
      (
        length(c1.normalized_phone) = 12 
        AND length(c2.normalized_phone) = 13
        AND c2.normalized_phone LIKE '55%'
        AND c1.normalized_phone LIKE '55%'
        -- Check if adding 9 after DDD makes them equal
        AND (
          substring(c1.normalized_phone, 1, 4) || '9' || substring(c1.normalized_phone, 5) = c2.normalized_phone
          OR substring(c2.normalized_phone, 1, 4) || substring(c2.normalized_phone, 6) = c1.normalized_phone
        )
      )
      OR
      (
        length(c1.normalized_phone) = 13 
        AND length(c2.normalized_phone) = 12
        AND c2.normalized_phone LIKE '55%'
        AND c1.normalized_phone LIKE '55%'
        AND (
          substring(c2.normalized_phone, 1, 4) || '9' || substring(c2.normalized_phone, 5) = c1.normalized_phone
          OR substring(c1.normalized_phone, 1, 4) || substring(c1.normalized_phone, 6) = c2.normalized_phone
        )
      )
      OR
      -- Match 10-digit with 11-digit (without country code)
      (
        length(c1.normalized_phone) = 10 
        AND length(c2.normalized_phone) = 11
        AND (
          substring(c1.normalized_phone, 1, 2) || '9' || substring(c1.normalized_phone, 3) = c2.normalized_phone
          OR substring(c2.normalized_phone, 1, 2) || substring(c2.normalized_phone, 4) = c1.normalized_phone
        )
      )
      OR
      (
        length(c1.normalized_phone) = 11 
        AND length(c2.normalized_phone) = 10
        AND (
          substring(c2.normalized_phone, 1, 2) || '9' || substring(c2.normalized_phone, 3) = c1.normalized_phone
          OR substring(c1.normalized_phone, 1, 2) || substring(c1.normalized_phone, 4) = c2.normalized_phone
        )
      )
  LOOP
    -- Decide which customer to keep (prefer one with more transactions, or older one)
    IF dup_record.trans1 >= dup_record.trans2 THEN
      keep_id := dup_record.id1;
      keep_phone := dup_record.phone1;
      delete_id := dup_record.id2;
      delete_phone := dup_record.phone2;
    ELSE
      keep_id := dup_record.id2;
      keep_phone := dup_record.phone2;
      delete_id := dup_record.id1;
      delete_phone := dup_record.phone1;
    END IF;
    
    -- Update transactions to point to kept customer's phone
    UPDATE transactions 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Update abandoned_events to point to kept customer's phone
    UPDATE abandoned_events 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Update delivery_link_generations to point to kept customer's phone
    UPDATE delivery_link_generations 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Merge customer data - keep best name, email, document
    UPDATE customers 
    SET 
      name = COALESCE(
        (SELECT name FROM customers WHERE id = keep_id AND name IS NOT NULL AND name != ''),
        (SELECT name FROM customers WHERE id = delete_id AND name IS NOT NULL AND name != '')
      ),
      email = COALESCE(
        (SELECT email FROM customers WHERE id = keep_id AND email IS NOT NULL AND email != ''),
        (SELECT email FROM customers WHERE id = delete_id AND email IS NOT NULL AND email != '')
      ),
      document = COALESCE(
        (SELECT document FROM customers WHERE id = keep_id AND document IS NOT NULL AND document != ''),
        (SELECT document FROM customers WHERE id = delete_id AND document IS NOT NULL AND document != '')
      ),
      display_phone = COALESCE(
        (SELECT display_phone FROM customers WHERE id = keep_id AND display_phone IS NOT NULL AND display_phone != ''),
        (SELECT display_phone FROM customers WHERE id = delete_id AND display_phone IS NOT NULL AND display_phone != '')
      ),
      first_seen_at = LEAST(
        (SELECT first_seen_at FROM customers WHERE id = keep_id),
        (SELECT first_seen_at FROM customers WHERE id = delete_id)
      ),
      updated_at = now()
    WHERE id = keep_id;
    
    -- Delete the duplicate customer
    DELETE FROM customers WHERE id = delete_id;
    
    merged_count := merged_count + 1;
    
    RAISE NOTICE 'Merged customer % into % (phones: % -> %)', delete_id, keep_id, delete_phone, keep_phone;
  END LOOP;
  
  RAISE NOTICE 'Total customers merged: %', merged_count;
END $$;

-- Now refresh all customer stats to recalculate correctly
SELECT refresh_customer_stats(NULL);
