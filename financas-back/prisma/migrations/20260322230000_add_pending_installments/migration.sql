-- Add isPending and installmentRef to transactions
ALTER TABLE `transactions`
  ADD COLUMN `is_pending` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `installment_ref` VARCHAR(64) NULL;
