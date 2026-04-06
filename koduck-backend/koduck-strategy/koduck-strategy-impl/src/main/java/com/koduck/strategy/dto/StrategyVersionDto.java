package com.koduck.strategy.dto;

import java.time.LocalDateTime;

/**
 * Strategy version DTO.
 *
 * @author Koduck Team
 * @param id the version ID
 * @param versionNumber the version number
 * @param code the strategy code
 * @param changelog the changelog
 * @param isActive whether this version is active
 * @param createdAt the creation timestamp
 */
public record StrategyVersionDto(
    Long id,
    Integer versionNumber,
    String code,
    String changelog,
    Boolean isActive,
    LocalDateTime createdAt
) {

    /**
     * Get a builder for StrategyVersionDto.
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for StrategyVersionDto.
     */
    public static class Builder {
        /** The version ID. */
        private Long id;

        /** The version number. */
        private Integer versionNumber;

        /** The strategy code. */
        private String code;

        /** The changelog. */
        private String changelog;

        /** Whether this version is active. */
        private Boolean isActive;

        /** The creation timestamp. */
        private LocalDateTime createdAt;

        /**
         * Set the ID.
         *
         * @param id the version ID
         * @return 构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Set the version number.
         *
         * @param versionNumber the version number
         * @return 构建器
         */
        public Builder versionNumber(Integer versionNumber) {
            this.versionNumber = versionNumber;
            return this;
        }

        /**
         * Set the code.
         *
         * @param code the strategy code
         * @return 构建器
         */
        public Builder code(String code) {
            this.code = code;
            return this;
        }

        /**
         * Set the changelog.
         *
         * @param changelog the changelog
         * @return 构建器
         */
        public Builder changelog(String changelog) {
            this.changelog = changelog;
            return this;
        }

        /**
         * Set the active status.
         *
         * @param isActive whether this version is active
         * @return 构建器
         */
        public Builder isActive(Boolean isActive) {
            this.isActive = isActive;
            return this;
        }

        /**
         * Set the creation timestamp.
         *
         * @param createdAt the creation timestamp
         * @return 构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Build the StrategyVersionDto.
         *
         * @return the StrategyVersionDto
         */
        public StrategyVersionDto build() {
            return new StrategyVersionDto(id, versionNumber, code, changelog, isActive, createdAt);
        }
    }
}
