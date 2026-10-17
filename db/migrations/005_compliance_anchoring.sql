-- Compliance records can carry the certificate file, and records + "copy sent" events become anchor leaves.
ALTER TABLE anchor_leaves DROP CONSTRAINT IF EXISTS anchor_leaves_leaf_kind_check;
ALTER TABLE anchor_leaves ADD CONSTRAINT anchor_leaves_leaf_kind_check CHECK (
  leaf_kind IN ('evidence', 'case_head', 'compliance_record', 'compliance_copy', 'compliance_certificate')
);

ALTER TABLE compliance_records
  ADD COLUMN certificate        bytea,
  ADD COLUMN certificate_mime   text,
  ADD COLUMN certificate_name   text,
  ADD COLUMN certificate_sha256 text;
