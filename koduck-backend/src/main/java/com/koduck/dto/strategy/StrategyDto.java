package com.koduck.dto.strategy;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Strategy DTO.
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
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private String name;
        private String description;
        private String status;
        private Integer currentVersion;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<StrategyParameterDto> parameters;
        
        public Builder id(Long id) {
            this.id = id;
            return this;
        }
        
        public Builder name(String name) {
            this.name = name;
            return this;
        }
        
        public Builder description(String description) {
            this.description = description;
            return this;
        }
        
        public Builder status(String status) {
            this.status = status;
            return this;
        }
        
        public Builder currentVersion(Integer currentVersion) {
            this.currentVersion = currentVersion;
            return this;
        }
        
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }
        
        public Builder parameters(List<StrategyParameterDto> parameters) {
            this.parameters = parameters;
            return this;
        }
        
        public StrategyDto build() {
            return new StrategyDto(id, name, description, status, currentVersion, 
                                  createdAt, updatedAt, parameters);
        }
    }
}
