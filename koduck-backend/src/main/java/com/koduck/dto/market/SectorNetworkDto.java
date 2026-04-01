package com.koduck.dto.market;

import com.koduck.util.CollectionCopyUtils;
import lombok.Builder;
import lombok.Data;
import lombok.Singular;

import java.math.BigDecimal;
import java.util.List;

/**
 * Sector network data DTO for force-directed graph visualization.
 * Represents sector correlations and capital flows.
 */
@Data
@Builder
public class SectorNetworkDto {
    
    @Singular
    private List<SectorNode> nodes;
    @Singular
    private List<SectorLink> links;

    public List<SectorNode> getNodes() {
        return CollectionCopyUtils.copyList(nodes);
    }

    public void setNodes(List<SectorNode> nodes) {
        this.nodes = CollectionCopyUtils.copyList(nodes);
    }

    public List<SectorLink> getLinks() {
        return CollectionCopyUtils.copyList(links);
    }

    public void setLinks(List<SectorLink> links) {
        this.links = CollectionCopyUtils.copyList(links);
    }
    
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
