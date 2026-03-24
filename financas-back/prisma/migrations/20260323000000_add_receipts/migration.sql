-- CreateTable receipts
CREATE TABLE `receipts` (
    `id`             VARCHAR(191) NOT NULL,
    `issuer_name`    VARCHAR(200) NULL,
    `issuer_cnpj`    VARCHAR(20)  NULL,
    `total_amount`   DECIMAL(15, 2) NOT NULL,
    `issue_date`     DATETIME(3)  NULL,
    `access_key`     VARCHAR(50)  NULL,
    `source`         VARCHAR(20)  NOT NULL DEFAULT 'image',
    `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id`        VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NULL,

    UNIQUE INDEX `receipts_transaction_id_key`(`transaction_id`),
    INDEX `receipts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable receipt_items
CREATE TABLE `receipt_items` (
    `id`          VARCHAR(191) NOT NULL,
    `description` VARCHAR(300) NOT NULL,
    `quantity`    DECIMAL(10, 3) NOT NULL,
    `unit`        VARCHAR(10)  NULL,
    `unit_price`  DECIMAL(15, 2) NOT NULL,
    `total_price` DECIMAL(15, 2) NOT NULL,
    `receipt_id`  VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NULL,

    INDEX `receipt_items_receipt_id_idx`(`receipt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey receipts → users
ALTER TABLE `receipts`
    ADD CONSTRAINT `receipts_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey receipts → transactions
ALTER TABLE `receipts`
    ADD CONSTRAINT `receipts_transaction_id_fkey`
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey receipt_items → receipts
ALTER TABLE `receipt_items`
    ADD CONSTRAINT `receipt_items_receipt_id_fkey`
    FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey receipt_items → categories
ALTER TABLE `receipt_items`
    ADD CONSTRAINT `receipt_items_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
