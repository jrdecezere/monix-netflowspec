-- CreateTable
CREATE TABLE `prefixes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `cidr` VARCHAR(18) NOT NULL,
    `ignore` BOOLEAN NOT NULL DEFAULT false,
    `bpsLimit` DOUBLE NULL,
    `ppsLimit` DOUBLE NULL,
    `synPpsLimit` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prefixes_cidr_key`(`cidr`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attack_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `targetIp` VARCHAR(45) NOT NULL,
    `prefixName` VARCHAR(120) NULL,
    `type` VARCHAR(32) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `peakBps` DOUBLE NOT NULL DEFAULT 0,
    `peakPps` DOUBLE NOT NULL DEFAULT 0,
    `evidence` JSON NULL,
    `alertedAt` DATETIME(3) NULL,
    `alertError` VARCHAR(255) NULL,

    INDEX `attack_events_status_startedAt_idx`(`status`, `startedAt`),
    INDEX `attack_events_targetIp_startedAt_idx`(`targetIp`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
