ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contractor_contract_no text,
  ADD COLUMN IF NOT EXISTS contractor_contract_date date,
  ADD COLUMN IF NOT EXISTS contractor_contract_value numeric(18,2),
  ADD COLUMN IF NOT EXISTS contractor_contract_content text;
