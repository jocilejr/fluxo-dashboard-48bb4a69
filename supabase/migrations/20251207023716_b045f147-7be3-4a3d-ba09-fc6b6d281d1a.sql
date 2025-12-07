-- Update customers with empty names from their most recent transaction
UPDATE customers c
SET name = subq.latest_name
FROM (
  SELECT DISTINCT ON (t.normalized_phone) 
    t.normalized_phone,
    t.customer_name as latest_name
  FROM transactions t
  WHERE t.customer_name IS NOT NULL 
    AND t.customer_name != ''
  ORDER BY t.normalized_phone, t.created_at DESC
) subq
WHERE c.normalized_phone = subq.normalized_phone
  AND (c.name IS NULL OR c.name = '');

-- Also update email if missing
UPDATE customers c
SET email = subq.latest_email
FROM (
  SELECT DISTINCT ON (t.normalized_phone) 
    t.normalized_phone,
    t.customer_email as latest_email
  FROM transactions t
  WHERE t.customer_email IS NOT NULL 
    AND t.customer_email != ''
  ORDER BY t.normalized_phone, t.created_at DESC
) subq
WHERE c.normalized_phone = subq.normalized_phone
  AND (c.email IS NULL OR c.email = '');

-- Update document if missing
UPDATE customers c
SET document = subq.latest_doc
FROM (
  SELECT DISTINCT ON (t.normalized_phone) 
    t.normalized_phone,
    t.customer_document as latest_doc
  FROM transactions t
  WHERE t.customer_document IS NOT NULL 
    AND t.customer_document != ''
  ORDER BY t.normalized_phone, t.created_at DESC
) subq
WHERE c.normalized_phone = subq.normalized_phone
  AND (c.document IS NULL OR c.document = '');