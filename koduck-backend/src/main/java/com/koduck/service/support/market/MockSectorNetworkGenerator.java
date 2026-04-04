package com.koduck.service.support.market;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.dto.market.SectorNetworkDto;

/**
 * Generator for mock sector-network data used when real data is unavailable.
 * Data is loaded from JSON resource file instead of hardcoded constants.
 *
 * @author Koduck Team
 */
@Component
@ConditionalOnProperty(prefix = "mock.sector-network", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MockSectorNetworkGenerator {

    private final ObjectMapper objectMapper;

    /**
     * Constructs a new MockSectorNetworkGenerator.
     *
     * @param objectMapper the object mapper for JSON deserialization
     */
    public MockSectorNetworkGenerator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Generates a mock sector network DTO.
     *
     * @param positiveLinkType the link type for positive correlations
     * @param negativeLinkType the link type for negative correlations
     * @return the sector network DTO
     * @throws IllegalStateException if failed to load mock data
     */
    public SectorNetworkDto generate(String positiveLinkType, String negativeLinkType) {
        SectorNetworkData data = loadMockData();
        List<SectorNetworkDto.SectorNode> nodes = data.nodes().stream()
                .map(this::toSectorNode)
                .toList();
        List<SectorNetworkDto.SectorLink> links = data.links().stream()
                .map(link -> toSectorLink(link, positiveLinkType, negativeLinkType))
                .toList();
        return SectorNetworkDto.builder()
                .nodes(nodes)
                .links(links)
                .build();
    }

    private SectorNetworkData loadMockData() {
        try {
            ClassPathResource resource = new ClassPathResource("mock/sector-network.json");
            return objectMapper.readValue(resource.getInputStream(), SectorNetworkData.class);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load mock sector network data", e);
        }
    }

    private SectorNetworkDto.SectorNode toSectorNode(SectorNodeData node) {
        return SectorNetworkDto.SectorNode.builder()
                .id(node.id())
                .name(node.name())
                .marketCap(BigDecimal.valueOf(node.marketCap()))
                .flow(BigDecimal.valueOf(node.flow()))
                .change(BigDecimal.valueOf(node.change()))
                .group(node.group())
                .build();
    }

    private SectorNetworkDto.SectorLink toSectorLink(SectorLinkData link,
            String positiveLinkType, String negativeLinkType) {
        String linkType = link.value() >= 0 ? positiveLinkType : negativeLinkType;
        return SectorNetworkDto.SectorLink.builder()
                .source(link.source())
                .target(link.target())
                .value(BigDecimal.valueOf(link.value()))
                .type(linkType)
                .build();
    }

    /**
     * Root data structure for JSON deserialization.
     */
    private record SectorNetworkData(
            List<SectorNodeData> nodes,
            List<SectorLinkData> links
    ) {
    }

    /**
     * Node data structure for JSON deserialization.
     */
    private record SectorNodeData(
            String id,
            String name,
            @JsonProperty("marketCap") double marketCap,
            double flow,
            double change,
            int group
    ) {
    }

    /**
     * Link data structure for JSON deserialization.
     */
    private record SectorLinkData(
            String source,
            String target,
            double value
    ) {
    }
}
