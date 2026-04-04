package com.koduck.dto.strategy;

import java.time.LocalDateTime;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

/**
 * 策略数据传输对象。
 *
 * @author Koduck Team
 * @param id the ID
 * @param name 名称
 * @param description the description
 * @param status 状态
 * @param currentVersion the current version
 * @param createdAt 创建时间 timestamp
 * @param updatedAt 更新时间 timestamp
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
     * 创建新的 Builder 实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * StrategyDto 的构建器。
     */
    public static class Builder {

        /** The ID. */
        private Long id;
        /** 名称。 */
        private String name;

        /** The description. */
        private String description;
        /** 状态。 */
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
         * @return 构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置名称。
         *
         * @param name 名称
         * @return 构建器
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the description.
         *
         * @param description the description
         * @return 构建器
         */
        public Builder description(String description) {
            this.description = description;
            return this;
        }

        /**
         * 设置状态。
         *
         * @param status 状态
         * @return 构建器
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the current version.
         *
         * @param currentVersion the current version
         * @return 构建器
         */
        public Builder currentVersion(Integer currentVersion) {
            this.currentVersion = currentVersion;
            return this;
        }

        /**
         * Sets the created at timestamp.
         *
         * @param createdAt 创建时间 timestamp
         * @return 构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at timestamp.
         *
         * @param updatedAt 更新时间 timestamp
         * @return 构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Sets the parameters.
         *
         * @param parameters the parameters
         * @return 构建器
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
