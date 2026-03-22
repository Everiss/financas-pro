-- AlterTable: adiciona transfer_id à tabela transactions
ALTER TABLE `transactions` ADD COLUMN `transfer_id` VARCHAR(191) NULL;

-- AlterEnum: adiciona TRANSFER ao enum AuditEntity
ALTER TABLE `audit_logs` MODIFY COLUMN `entity` ENUM('TRANSACTION', 'ACCOUNT', 'BANK', 'GOAL', 'REMINDER', 'CATEGORY', 'TRANSFER') NOT NULL;

-- CreateTable: transfers
CREATE TABLE `transfers` (
    `id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` TEXT NULL,
    `is_bill_payment` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `from_account_id` VARCHAR(191) NOT NULL,
    `to_account_id` VARCHAR(191) NOT NULL,
    `from_tx_id` VARCHAR(191) NOT NULL,
    `to_tx_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `transfers_from_tx_id_key`(`from_tx_id`),
    UNIQUE INDEX `transfers_to_tx_id_key`(`to_tx_id`),
    INDEX `transfers_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_from_account_id_fkey` FOREIGN KEY (`from_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_to_account_id_fkey` FOREIGN KEY (`to_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_from_tx_id_fkey` FOREIGN KEY (`from_tx_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_to_tx_id_fkey` FOREIGN KEY (`to_tx_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
