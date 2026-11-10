-- Reordena a chave primária das tabelas de fluxo: tempo PRIMEIRO.
--
-- Com a chave antiga (peer_ip_src, ...) o MySQL lia "os últimos minutos" pelo
-- índice de stamp_inserted e buscava cada linha no índice primário, uma a uma
-- (E/S aleatória): ~230 s para 700 mil linhas contra ~0,1 s com a chave nova.
--
-- Em vez de ALTER TABLE (reconstrói a tabela inteira e segura o coletor por
-- muito tempo em bases grandes), criamos a tabela nova vazia e trocamos por
-- RENAME (atômico). O histórico antigo (flow_dst/flow_src_port) é descartado:
-- ele só serve para detecção em tempo real, e o gráfico usa traffic_minute.

CREATE TABLE `flow_dst_new` (
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

    INDEX `flow_dst_ip_dst_stamp_inserted_idx`(`ip_dst`, `stamp_inserted`),
    PRIMARY KEY (`stamp_inserted`, `peer_ip_src`, `iface_in`, `ip_dst`, `ip_proto`, `tcp_flags`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `flow_src_port_new` (
    `peer_ip_src` CHAR(45) NOT NULL,
    `iface_in` INTEGER UNSIGNED NOT NULL,
    `ip_proto` CHAR(6) NOT NULL,
    `port_src` INTEGER UNSIGNED NOT NULL,
    `packets` INTEGER UNSIGNED NOT NULL,
    `bytes` BIGINT UNSIGNED NOT NULL,
    `flows` INTEGER UNSIGNED NOT NULL,
    `stamp_inserted` DATETIME(0) NOT NULL,
    `stamp_updated` DATETIME(0) NULL,

    PRIMARY KEY (`stamp_inserted`, `peer_ip_src`, `iface_in`, `ip_proto`, `port_src`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

RENAME TABLE `flow_dst` TO `flow_dst_old`, `flow_dst_new` TO `flow_dst`,
             `flow_src_port` TO `flow_src_port_old`, `flow_src_port_new` TO `flow_src_port`;

DROP TABLE `flow_dst_old`;
DROP TABLE `flow_src_port_old`;
