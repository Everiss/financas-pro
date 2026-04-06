-- Add completed_at to goals (auto-set when currentAmount reaches targetAmount)
ALTER TABLE `goals` ADD COLUMN `completed_at` DATETIME(3) NULL;

-- Add completed_at to reminders (manually set via confirm endpoint)
ALTER TABLE `reminders` ADD COLUMN `completed_at` DATETIME(3) NULL;
