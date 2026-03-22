package com.koduck.dto.market;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Sector network data DTO for force-directed graph visualization.
 * Represents sector correlations and capital flows.
 */
@Data
@Builder
public class SectorNetworkDto {
    
    private List<SectorNode> nodes;
    private List<SectorLink> links;
    
    /**
     * Sector node representing a market sector.
     */
    @Data
    @Builder
    public static class SectorNode {
        private String id;
        private String name;
        private BigDecimal marketCap;
        private BigDecimal flow;
        private BigDecimal change;
        private Integer group;
        private Double x;
        private Double y;
    }
    
    /**
     * Sector link representing correlation between two sectors.
     */
    @Data
    @Builder
    public static class SectorLink {
        private String source;
        private String target;
        private BigDecimal value;
        private String type;
    }
}
