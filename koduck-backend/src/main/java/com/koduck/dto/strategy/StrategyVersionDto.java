package com.koduck.dto.strategy;
import java.time.LocalDateTime;

/**
 * Strategy version DTO.
 */
public record StrategyVersionDto(
    Long id,
    Integer versionNumber,
    String code,
    String changelog,
    Boolean isActive,
    LocalDateTime createdAt
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private Integer versionNumber;
        private String code;
        private String changelog;
        private Boolean isActive;
        private LocalDateTime createdAt;
        
        public Builder id(Long id) {
            this.id = id;
            return this;
        }
        
        public Builder versionNumber(Integer versionNumber) {
            this.versionNumber = versionNumber;
            return this;
        }
        
        public Builder code(String code) {
            this.code = code;
            return this;
        }
        
        public Builder changelog(String changelog) {
            this.changelog = changelog;
            return this;
        }
        
        public Builder isActive(Boolean isActive) {
            this.isActive = isActive;
            return this;
        }
        
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }
        
        public StrategyVersionDto build() {
            return new StrategyVersionDto(id, versionNumber, code, changelog, isActive, createdAt);
        }
    }
}
