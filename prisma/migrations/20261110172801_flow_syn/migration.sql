-- CreateTable
CREATE TABLE `flow_syn` (
    `peer_ip_src` CHAR(45) NOT NULL,
    `iface_in` INTEGER UNSIGNED NOT NULL,
    `ip_dst` CHAR(45) NOT NULL,
    `packets` INTEGER UNSIGNED NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `flows` INTEGER UNSIGNED NOT NULL,
    `stamp_inserted` DATETIME(0) NOT NULL,
    `stamp_updated` DATETIME(0) NULL,

    INDEX `flow_syn_stamp_inserted_idx`(`stamp_inserted`),
    INDEX `flow_syn_ip_dst_stamp_inserted_idx`(`ip_dst`, `stamp_inserted`),
    PRIMARY KEY (`peer_ip_src`, `iface_in`, `ip_dst`, `stamp_inserted`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Retenção de 7 dias, como as demais tabelas de fluxo.
CREATE EVENT IF NOT EXISTS `purge_flow_syn`
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM `flow_syn` WHERE `stamp_inserted` < NOW() - INTERVAL 7 DAY LIMIT 100000;
