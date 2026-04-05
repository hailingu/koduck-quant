package com.koduck.service.support.market;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.market.dto.SectorNetworkDto;

/**
 * 真实数据不可用时使用的模拟板块网络数据生成器。
 * 数据从JSON资源文件加载，而不是硬编码常量。
 *
 * @author Koduck Team
 */
@Component
@ConditionalOnProperty(prefix = "mock.sector-network", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MockSectorNetworkGenerator {

    /** 用于JSON反序列化的对象映射器。 */
    private final ObjectMapper objectMapper;

    /**
     * 构造新的MockSectorNetworkGenerator。
     *
     * @param objectMapper 用于JSON反序列化的对象映射器
     */
    public MockSectorNetworkGenerator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 生成模拟板块网络DTO。
     *
     * @param positiveLinkType 正向相关性的链接类型
     * @param negativeLinkType 负向相关性的链接类型
     * @return 板块网络DTO
     * @throws IllegalStateException 如果加载模拟数据失败
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
        }
        catch (IOException e) {
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
     * JSON反序列化的根数据结构。
     *
     * @param nodes 板块节点列表
     * @param links 板块链接列表
     */
    private record SectorNetworkData(
            List<SectorNodeData> nodes,
            List<SectorLinkData> links
    ) {
    }

    /**
     * JSON反序列化的节点数据结构。
     *
     * @param id 节点ID
     * @param name 节点名称
     * @param marketCap 市值
     * @param flow 资金流向
     * @param change 涨跌幅
     * @param group 分组
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
     * JSON反序列化的链接数据结构。
     *
     * @param source 源节点ID
     * @param target 目标节点ID
     * @param value 链接值
     */
    private record SectorLinkData(
            String source,
            String target,
            double value
    ) {
    }
}
