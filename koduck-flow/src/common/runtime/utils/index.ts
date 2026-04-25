/**
 * Runtime 工具函数统一导出
 * @module runtime/utils
 */

// 租户工具
export { cloneTenantContext, cloneTenantResourceQuotas } from "./tenant-utils";

// 哈希工具
export { hashString, clampPercentage } from "./hash-utils";
