-- Add loan and financing to AccountType enum
ALTER TABLE `bank_accounts`
  MODIFY COLUMN `type` ENUM('checking','savings','investment','credit','loan','financing') NOT NULL;
