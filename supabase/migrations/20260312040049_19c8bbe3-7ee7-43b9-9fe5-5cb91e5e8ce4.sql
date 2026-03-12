-- Consolidate duplicate member_products where last 8 digits match for same product_id
-- Keep the oldest record (smallest granted_at), delete the rest
DELETE FROM member_products
WHERE id IN (
  SELECT mp.id
  FROM member_products mp
  INNER JOIN (
    SELECT 
      product_id,
      RIGHT(normalized_phone, 8) AS phone_suffix,
      MIN(granted_at) AS earliest_granted
    FROM member_products
    WHERE LENGTH(normalized_phone) >= 8
    GROUP BY product_id, RIGHT(normalized_phone, 8)
    HAVING COUNT(*) > 1
  ) dups ON mp.product_id = dups.product_id 
    AND RIGHT(mp.normalized_phone, 8) = dups.phone_suffix
    AND mp.granted_at > dups.earliest_granted
);

-- Also consolidate member_pixel_frames duplicates
DELETE FROM member_pixel_frames
WHERE id IN (
  SELECT mpf.id
  FROM member_pixel_frames mpf
  INNER JOIN (
    SELECT 
      product_id,
      RIGHT(normalized_phone, 8) AS phone_suffix,
      MIN(created_at) AS earliest
    FROM member_pixel_frames
    WHERE LENGTH(normalized_phone) >= 8
    GROUP BY product_id, RIGHT(normalized_phone, 8)
    HAVING COUNT(*) > 1
  ) dups ON mpf.product_id = dups.product_id
    AND RIGHT(mpf.normalized_phone, 8) = dups.phone_suffix
    AND mpf.created_at > dups.earliest
);