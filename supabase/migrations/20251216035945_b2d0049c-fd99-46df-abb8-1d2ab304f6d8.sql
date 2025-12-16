-- Migration: Merge remaining duplicate customers by last 8 digits of phone number
-- This handles cases where phone numbers are malformed (missing DDD)

DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
  delete_id uuid;
  keep_phone text;
  delete_phone text;
  merged_name text;
  merged_email text;
  merged_document text;
BEGIN
  -- Find and merge duplicates based on last 8 digits
  FOR dup IN 
    WITH phone_cores AS (
      SELECT 
        id,
        normalized_phone,
        name,
        email,
        document,
        total_transactions,
        total_paid,
        RIGHT(normalized_phone, 8) as phone_core,
        LENGTH(normalized_phone) as phone_len
      FROM customers
      WHERE LENGTH(normalized_phone) >= 8
    ),
    duplicates AS (
      SELECT 
        a.id as id1,
        a.normalized_phone as phone1,
        a.name as name1,
        a.email as email1,
        a.document as doc1,
        a.total_transactions as trans1,
        a.total_paid as paid1,
        a.phone_len as len1,
        b.id as id2,
        b.normalized_phone as phone2,
        b.name as name2,
        b.email as email2,
        b.document as doc2,
        b.total_transactions as trans2,
        b.total_paid as paid2,
        b.phone_len as len2
      FROM phone_cores a
      JOIN phone_cores b ON RIGHT(a.normalized_phone, 8) = RIGHT(b.normalized_phone, 8)
        AND a.id < b.id
        AND a.normalized_phone != b.normalized_phone
    )
    SELECT * FROM duplicates
  LOOP
    -- Determine which record to keep (prefer longer phone number, then more transactions)
    IF dup.len1 >= dup.len2 OR (dup.len1 = dup.len2 AND dup.trans1 >= dup.trans2) THEN
      keep_id := dup.id1;
      keep_phone := dup.phone1;
      delete_id := dup.id2;
      delete_phone := dup.phone2;
      merged_name := COALESCE(dup.name1, dup.name2);
      merged_email := COALESCE(dup.email1, dup.email2);
      merged_document := COALESCE(dup.doc1, dup.doc2);
    ELSE
      keep_id := dup.id2;
      keep_phone := dup.phone2;
      delete_id := dup.id1;
      delete_phone := dup.phone1;
      merged_name := COALESCE(dup.name2, dup.name1);
      merged_email := COALESCE(dup.email2, dup.email1);
      merged_document := COALESCE(dup.doc2, dup.doc1);
    END IF;
    
    RAISE NOTICE 'Merging % into %', delete_phone, keep_phone;
    
    -- Update transactions to point to kept phone
    UPDATE transactions 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Update abandoned_events to point to kept phone
    UPDATE abandoned_events 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Update delivery_link_generations to point to kept phone
    UPDATE delivery_link_generations 
    SET normalized_phone = keep_phone 
    WHERE normalized_phone = delete_phone;
    
    -- Update kept customer with merged data
    UPDATE customers SET
      name = merged_name,
      email = merged_email,
      document = merged_document,
      updated_at = now()
    WHERE id = keep_id;
    
    -- Delete duplicate customer
    DELETE FROM customers WHERE id = delete_id;
  END LOOP;
END $$;

-- Refresh all customer stats to recalculate totals
SELECT refresh_customer_stats(NULL);