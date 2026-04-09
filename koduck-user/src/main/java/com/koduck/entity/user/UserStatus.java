package com.koduck.entity.user;

/**
 * User status enum, mapped to SMALLINT in database.
 * ORDINAL values must match the database convention:
 * 0 = DISABLED, 1 = ACTIVE, 2 = PENDING
 */
public enum UserStatus {
    DISABLED,
    ACTIVE,
    PENDING
}
