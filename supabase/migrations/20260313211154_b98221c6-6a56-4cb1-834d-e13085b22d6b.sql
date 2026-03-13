DROP INDEX IF EXISTS idx_pos_sales_dedup_hash;
CREATE UNIQUE INDEX idx_pos_sales_dedup_hash ON pos_sales (dedup_hash);
