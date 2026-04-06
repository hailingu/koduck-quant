package com.koduck.market.dto;

import java.math.BigDecimal;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.Builder;
import lombok.Data;
import lombok.Singular;

/**
 * Sector network data DTO for force-directed graph visualization.
 * Represents sector correlations and capital flows.
 *
 * @author Koduck Team
 */
@Data
@Builder
public class SectorNetworkDto {

    /** The list of sector nodes. */
    @Singular
    private List<SectorNode> nodes;

    /** The list of sector links. */
    @Singular
    private List<SectorLink> links;

    /**
     * Get the nodes.
     *
     * @return the nodes list
     */
    public List<SectorNode> getNodes() {
        return CollectionCopyUtils.copyList(nodes);
    }

    /**
     * Set the nodes.
     *
     * @param nodes the nodes to set
     */
    public void setNodes(List<SectorNode> nodes) {
        this.nodes = CollectionCopyUtils.copyList(nodes);
    }

    /**
     * Get the links.
     *
     * @return the links list
     */
    public List<SectorLink> getLinks() {
        return CollectionCopyUtils.copyList(links);
    }

    /**
     * Set the links.
     *
     * @param links the links to set
     */
    public void setLinks(List<SectorLink> links) {
        this.links = CollectionCopyUtils.copyList(links);
    }

    /**
     * Sector node representing a market sector.
     */
    @Data
    @Builder
    public static class SectorNode {
        /** The node ID. */
        private String id;

        /** The node name. */
        private String name;

        /** The market capitalization. */
        private BigDecimal marketCap;

        /** The capital flow. */
        private BigDecimal flow;

        /** The price change. */
        private BigDecimal change;

        /** The group ID. */
        private Integer group;

        /** The X coordinate. */
        private Double x;

        /** The Y coordinate. */
        private Double y;
    }

    /**
     * Sector link representing correlation between two sectors.
     */
    @Data
    @Builder
    public static class SectorLink {
        /** The source node ID. */
        private String source;

        /** The target node ID. */
        private String target;

        /** The link value. */
        private BigDecimal value;

        /** The link type. */
        private String type;
    }
}
