-- CreateTable
CREATE TABLE `traffic_minute` (
    `stamp` DATETIME(0) NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `packets` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`stamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Retenção de 7 dias, como as demais tabelas de fluxo.
CREATE EVENT IF NOT EXISTS `purge_traffic_minute`
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM `traffic_minute` WHERE `stamp` < NOW() - INTERVAL 7 DAY LIMIT 100000;
