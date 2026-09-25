-- Admin V2 P2: let a reviewed version change fulfilment without mutating
-- the customer's original order request.

ALTER TABLE order_revisions
  ADD COLUMN fulfilment_method TEXT
  CHECK (fulfilment_method IS NULL OR fulfilment_method IN ('delivery', 'collection'));

ALTER TABLE order_revisions ADD COLUMN delivery_address_line1 TEXT;
ALTER TABLE order_revisions ADD COLUMN delivery_address_line2 TEXT;
ALTER TABLE order_revisions ADD COLUMN delivery_town TEXT;
ALTER TABLE order_revisions ADD COLUMN delivery_county TEXT;
ALTER TABLE order_revisions ADD COLUMN delivery_postcode TEXT;
ALTER TABLE order_revisions
  ADD COLUMN delivery_country TEXT
  CHECK (delivery_country IS NULL OR length(delivery_country) = 2);
