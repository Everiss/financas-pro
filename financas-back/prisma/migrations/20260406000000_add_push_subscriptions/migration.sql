CREATE TABLE `push_subscriptions` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `endpoint`   LONGTEXT     NOT NULL,
  `p256dh`     LONGTEXT     NOT NULL,
  `auth`       LONGTEXT     NOT NULL,
  `user_agent` VARCHAR(300) NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `push_subscriptions_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `push_subscriptions`
  ADD CONSTRAINT `push_subscriptions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
