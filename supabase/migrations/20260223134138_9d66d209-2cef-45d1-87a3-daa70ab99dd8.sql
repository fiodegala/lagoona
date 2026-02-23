
ALTER TABLE products ADD COLUMN wholesale_price numeric NULL;
ALTER TABLE products ADD COLUMN exclusive_price numeric NULL;

ALTER TABLE product_variations ADD COLUMN wholesale_price numeric NULL;
ALTER TABLE product_variations ADD COLUMN exclusive_price numeric NULL;
