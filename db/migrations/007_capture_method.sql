-- How a photo arrived: taken in Docket's live camera ('live') or chosen from the device ('upload').
-- Reported by the browser, so it's a label for the landlord, not proof.
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS capture_method text;
