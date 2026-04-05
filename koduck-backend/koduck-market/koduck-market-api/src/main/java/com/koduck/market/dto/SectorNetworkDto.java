package com.koduck.market.dto;

import java.util.List;

/**
 * 板块网络关系数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param market      市场代码
 * @param sectors     板块列表
 * @param relationships 板块间关系
 * @author Koduck Team
 */
public record SectorNetworkDto(
        String market,
        List<SectorNode> sectors,
        List<SectorEdge> relationships
) {

    /**
     * 板块节点。
     *
     * @param id    板块ID
     * @param name  板块名称
     * @param size  板块大小（股票数量）
     * @param value 板块值（如涨跌幅）
     */
    public record SectorNode(
            String id,
            String name,
            int size,
            double value
    ) {
    }

    /**
     * 板块关系边。
     *
     * @param source 源板块ID
     * @param target 目标板块ID
     * @param weight 关联权重
     */
    public record SectorEdge(
            String source,
            String target,
            double weight
    ) {
    }
}
