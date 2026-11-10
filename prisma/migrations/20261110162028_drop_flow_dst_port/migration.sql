/*
  Warnings:

  - You are about to drop the `flow_dst_port` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `flow_dst_port`;

DROP EVENT IF EXISTS `purge_flow_dst_port`;
