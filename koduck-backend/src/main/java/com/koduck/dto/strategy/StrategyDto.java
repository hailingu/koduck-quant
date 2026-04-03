package com.koduck.dto.strategy;

import java.time.LocalDateTime;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

/**
 * Strategy DTO.
 *
 * @author Koduck Team
 * @param id the ID
 * @param name the name
 * @param description the description
 * @param status the status
 * @param currentVersion the current version
 * @param createdAt the created at timestamp
 * @param updatedAt the updated at timestamp
 * @param parameters the parameters
 */
public record StrategyDto(
    Long id,
    String name,
    String description,
    String status,
    Integer currentVersion,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<StrategyParameterDto> parameters
) {
    public StrategyDto {
        parameters = CollectionCopyUtils.copyList(parameters);
    }

    @Override
    public List<StrategyParameterDto> parameters() {
        return CollectionCopyUtils.copyList(parameters);
    }

    /**
     * Creates a new Builder instance.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for StrategyDto.
     */
    public static class Builder {

        /** The ID. */
        private Long id;

        /** The name. */
        private String name;

        /** The description. */
        private String description;

        /** The status. */
        private String status;

        /** The current version. */
        private Integer currentVersion;

        /** The created at timestamp. */
        private LocalDateTime createdAt;

        /** The updated at timestamp. */
        private LocalDateTime updatedAt;

        /** The parameters. */
        private List<StrategyParameterDto> parameters;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return the builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the name.
         *
         * @param name the name
         * @return the builder
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the description.
         *
         * @param description the description
         * @return the builder
         */
        public Builder description(String description) {
            this.description = description;
            return this;
        }

        /**
         * Sets the status.
         *
         * @param status the status
         * @return the builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the current version.
         *
         * @param currentVersion the current version
         * @return the builder
         */
        public Builder currentVersion(Integer currentVersion) {
            this.currentVersion = currentVersion;
            return this;
        }

        /**
         * Sets the created at timestamp.
         *
         * @param createdAt the created at timestamp
         * @return the builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at timestamp.
         *
         * @param updatedAt the updated at timestamp
         * @return the builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Sets the parameters.
         *
         * @param parameters the parameters
         * @return the builder
         */
        public Builder parameters(List<StrategyParameterDto> parameters) {
            this.parameters = CollectionCopyUtils.copyList(parameters);
            return this;
        }

        /**
         * Builds the StrategyDto.
         *
         * @return the StrategyDto
         */
        public StrategyDto build() {
            return new StrategyDto(id, name, description, status, currentVersion,
                    createdAt, updatedAt, parameters);
        }
    }
}
