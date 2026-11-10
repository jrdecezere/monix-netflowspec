-- CreateTable
CREATE TABLE `flow_dst` (
    `peer_ip_src` CHAR(45) NOT NULL,
    `iface_in` INTEGER UNSIGNED NOT NULL,
    `ip_dst` CHAR(45) NOT NULL,
    `ip_proto` CHAR(6) NOT NULL,
    `tcp_flags` INTEGER UNSIGNED NOT NULL,
    `packets` INTEGER UNSIGNED NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `flows` INTEGER UNSIGNED NOT NULL,
    `stamp_inserted` DATETIME(0) NOT NULL,
    `stamp_updated` DATETIME(0) NULL,

    INDEX `flow_dst_stamp_inserted_idx`(`stamp_inserted`),
    INDEX `flow_dst_ip_dst_stamp_inserted_idx`(`ip_dst`, `stamp_inserted`),
    PRIMARY KEY (`peer_ip_src`, `iface_in`, `ip_dst`, `ip_proto`, `tcp_flags`, `stamp_inserted`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flow_src_port` (
    `peer_ip_src` CHAR(45) NOT NULL,
    `iface_in` INTEGER UNSIGNED NOT NULL,
    `ip_proto` CHAR(6) NOT NULL,
    `port_src` INTEGER UNSIGNED NOT NULL,
    `packets` INTEGER UNSIGNED NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `flows` INTEGER UNSIGNED NOT NULL,
    `stamp_inserted` DATETIME(0) NOT NULL,
    `stamp_updated` DATETIME(0) NULL,

    INDEX `flow_src_port_stamp_inserted_idx`(`stamp_inserted`),
    PRIMARY KEY (`peer_ip_src`, `iface_in`, `ip_proto`, `port_src`, `stamp_inserted`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flow_dst_port` (
    `peer_ip_src` CHAR(45) NOT NULL,
    `iface_in` INTEGER UNSIGNED NOT NULL,
    `ip_proto` CHAR(6) NOT NULL,
    `port_dst` INTEGER UNSIGNED NOT NULL,
    `packets` INTEGER UNSIGNED NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `flows` INTEGER UNSIGNED NOT NULL,
    `stamp_inserted` DATETIME(0) NOT NULL,
    `stamp_updated` DATETIME(0) NULL,

    INDEX `flow_dst_port_stamp_inserted_idx`(`stamp_inserted`),
    PRIMARY KEY (`peer_ip_src`, `iface_in`, `ip_proto`, `port_dst`, `stamp_inserted`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Retenção: apaga baldes com mais de 7 dias (precisa do event_scheduler ligado,
-- que é o padrão no MySQL 8). Ajuste o intervalo conforme o espaço em disco.
CREATE EVENT IF NOT EXISTS `purge_flow_dst`
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM `flow_dst` WHERE `stamp_inserted` < NOW() - INTERVAL 7 DAY LIMIT 100000;

CREATE EVENT IF NOT EXISTS `purge_flow_src_port`
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM `flow_src_port` WHERE `stamp_inserted` < NOW() - INTERVAL 7 DAY LIMIT 100000;

CREATE EVENT IF NOT EXISTS `purge_flow_dst_port`
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM `flow_dst_port` WHERE `stamp_inserted` < NOW() - INTERVAL 7 DAY LIMIT 100000;
