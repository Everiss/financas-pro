-- Add subtype column
ALTER TABLE bank_accounts ADD COLUMN subtype VARCHAR(50) NULL;

-- Expand InvestmentType enum with new values
ALTER TABLE bank_accounts
  MODIFY COLUMN investment_type ENUM('cdb','stock','fund','fii','other','tesouro','previdencia','crypto') NULL;
