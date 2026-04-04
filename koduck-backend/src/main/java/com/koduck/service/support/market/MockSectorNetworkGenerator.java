package com.koduck.service.support.market;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Component;

import com.koduck.dto.market.SectorNetworkDto;

/**
 * Generator for mock sector-network data used when real data is unavailable.
 *
 * @author Koduck Team
 */
@Component
public class MockSectorNetworkGenerator {

    /** Sector node group 1. */
    private static final int SECTOR_NODE_GROUP_1 = 1;
    /** Sector node group 2. */
    private static final int SECTOR_NODE_GROUP_2 = 2;
    /** Sector node group 3. */
    private static final int SECTOR_NODE_GROUP_3 = 3;
    /** Sector node group 4. */
    private static final int SECTOR_NODE_GROUP_4 = 4;
    /** Sector node group 5. */
    private static final int SECTOR_NODE_GROUP_5 = 5;
    /** Sector node group 6. */
    private static final int SECTOR_NODE_GROUP_6 = 6;
    /** Sector node group 7. */
    private static final int SECTOR_NODE_GROUP_7 = 7;
    /** Sector node group 8. */
    private static final int SECTOR_NODE_GROUP_8 = 8;

    /** Market cap 8500. */
    private static final BigDecimal MARKET_CAP_8500 = new BigDecimal("8500");
    /** Market cap 4200. */
    private static final BigDecimal MARKET_CAP_4200 = new BigDecimal("4200");
    /** Market cap 3800. */
    private static final BigDecimal MARKET_CAP_3800 = new BigDecimal("3800");
    /** Market cap 2900. */
    private static final BigDecimal MARKET_CAP_2900 = new BigDecimal("2900");
    /** Market cap 12000. */
    private static final BigDecimal MARKET_CAP_12000 = new BigDecimal("12000");
    /** Market cap 5600. */
    private static final BigDecimal MARKET_CAP_5600 = new BigDecimal("5600");
    /** Market cap 4800. */
    private static final BigDecimal MARKET_CAP_4800 = new BigDecimal("4800");
    /** Market cap 9200. */
    private static final BigDecimal MARKET_CAP_9200 = new BigDecimal("9200");
    /** Market cap 6500. */
    private static final BigDecimal MARKET_CAP_6500 = new BigDecimal("6500");
    /** Market cap 7200. */
    private static final BigDecimal MARKET_CAP_7200 = new BigDecimal("7200");
    /** Market cap 6800. */
    private static final BigDecimal MARKET_CAP_6800 = new BigDecimal("6800");
    /** Market cap 5200. */
    private static final BigDecimal MARKET_CAP_5200 = new BigDecimal("5200");
    /** Market cap 5800. */
    private static final BigDecimal MARKET_CAP_5800 = new BigDecimal("5800");
    /** Market cap 3600. */
    private static final BigDecimal MARKET_CAP_3600 = new BigDecimal("3600");
    /** Market cap 3400. */
    private static final BigDecimal MARKET_CAP_3400 = new BigDecimal("3400");
    /** Market cap 2800. */
    private static final BigDecimal MARKET_CAP_2800 = new BigDecimal("2800");

    /** Fund flow 67.3. */
    private static final BigDecimal FLOW_67_3 = new BigDecimal("67.3");
    /** Fund flow 34.2. */
    private static final BigDecimal FLOW_34_2 = new BigDecimal("34.2");
    /** Fund flow 28.5. */
    private static final BigDecimal FLOW_28_5 = new BigDecimal("28.5");
    /** Fund flow 15.8. */
    private static final BigDecimal FLOW_15_8 = new BigDecimal("15.8");
    /** Fund flow 45.2. */
    private static final BigDecimal FLOW_45_2 = new BigDecimal("45.2");
    /** Fund flow 12.3. */
    private static final BigDecimal FLOW_12_3 = new BigDecimal("12.3");
    /** Fund flow -8.5. */
    private static final BigDecimal FLOW_NEG_8_5 = new BigDecimal("-8.5");
    /** Fund flow -67.5. */
    private static final BigDecimal FLOW_NEG_67_5 = new BigDecimal("-67.5");
    /** Fund flow -45.2. */
    private static final BigDecimal FLOW_NEG_45_2 = new BigDecimal("-45.2");
    /** Fund flow -22.3. */
    private static final BigDecimal FLOW_NEG_22_3 = new BigDecimal("-22.3");
    /** Fund flow -12.1. */
    private static final BigDecimal FLOW_NEG_12_1 = new BigDecimal("-12.1");
    /** Fund flow 8.5. */
    private static final BigDecimal FLOW_8_5 = new BigDecimal("8.5");
    /** Fund flow 23.4. */
    private static final BigDecimal FLOW_23_4 = new BigDecimal("23.4");
    /** Fund flow 18.9. */
    private static final BigDecimal FLOW_18_9 = new BigDecimal("18.9");
    /** Fund flow 15.6. */
    private static final BigDecimal FLOW_15_6 = new BigDecimal("15.6");
    /** Fund flow 12.8. */
    private static final BigDecimal FLOW_12_8 = new BigDecimal("12.8");
    /** Fund flow -45.6. */
    private static final BigDecimal FLOW_NEG_45_6 = new BigDecimal("-45.6");
    /** Fund flow -18.9. */
    private static final BigDecimal FLOW_NEG_18_9 = new BigDecimal("-18.9");

    /** Change 3.2. */
    private static final BigDecimal CHANGE_3_2 = new BigDecimal("3.2");
    /** Change 2.8. */
    private static final BigDecimal CHANGE_2_8 = new BigDecimal("2.8");
    /** Change 2.1. */
    private static final BigDecimal CHANGE_2_1 = new BigDecimal("2.1");
    /** Change 1.9. */
    private static final BigDecimal CHANGE_1_9 = new BigDecimal("1.9");
    /** Change 1.2. */
    private static final BigDecimal CHANGE_1_2 = new BigDecimal("1.2");
    /** Change 0.8. */
    private static final BigDecimal CHANGE_0_8 = new BigDecimal("0.8");
    /** Change -0.5. */
    private static final BigDecimal CHANGE_NEG_0_5 = new BigDecimal("-0.5");
    /** Change -2.8. */
    private static final BigDecimal CHANGE_NEG_2_8 = new BigDecimal("-2.8");
    /** Change -2.1. */
    private static final BigDecimal CHANGE_NEG_2_1 = new BigDecimal("-2.1");
    /** Change -1.5. */
    private static final BigDecimal CHANGE_NEG_1_5 = new BigDecimal("-1.5");
    /** Change -0.8. */
    private static final BigDecimal CHANGE_NEG_0_8 = new BigDecimal("-0.8");
    /** Change 0.5. */
    private static final BigDecimal CHANGE_0_5 = new BigDecimal("0.5");
    /** Change 1.5. */
    private static final BigDecimal CHANGE_1_5 = new BigDecimal("1.5");
    /** Change 0.9. */
    private static final BigDecimal CHANGE_0_9 = new BigDecimal("0.9");
    /** Change 0.7. */
    private static final BigDecimal CHANGE_0_7 = new BigDecimal("0.7");
    /** Change -3.2. */
    private static final BigDecimal CHANGE_NEG_3_2 = new BigDecimal("-3.2");
    /** Change -1.8. */
    private static final BigDecimal CHANGE_NEG_1_8 = new BigDecimal("-1.8");

    /** Link value 0.85. */
    private static final BigDecimal LINK_VALUE_0_85 = new BigDecimal("0.85");
    /** Link value 0.78. */
    private static final BigDecimal LINK_VALUE_0_78 = new BigDecimal("0.78");
    /** Link value 0.72. */
    private static final BigDecimal LINK_VALUE_0_72 = new BigDecimal("0.72");
    /** Link value 0.65. */
    private static final BigDecimal LINK_VALUE_0_65 = new BigDecimal("0.65");
    /** Link value 0.68. */
    private static final BigDecimal LINK_VALUE_0_68 = new BigDecimal("0.68");
    /** Link value 0.55. */
    private static final BigDecimal LINK_VALUE_0_55 = new BigDecimal("0.55");
    /** Link value 0.82. */
    private static final BigDecimal LINK_VALUE_0_82 = new BigDecimal("0.82");
    /** Link value 0.75. */
    private static final BigDecimal LINK_VALUE_0_75 = new BigDecimal("0.75");
    /** Link value 0.70. */
    private static final BigDecimal LINK_VALUE_0_70 = new BigDecimal("0.70");
    /** Link value 0.62. */
    private static final BigDecimal LINK_VALUE_0_62 = new BigDecimal("0.62");
    /** Link value 0.58. */
    private static final BigDecimal LINK_VALUE_0_58 = new BigDecimal("0.58");
    /** Link value -0.65. */
    private static final BigDecimal LINK_VALUE_NEG_0_65 = new BigDecimal("-0.65");
    /** Link value -0.45. */
    private static final BigDecimal LINK_VALUE_NEG_0_45 = new BigDecimal("-0.45");
    /** Link value -0.55. */
    private static final BigDecimal LINK_VALUE_NEG_0_55 = new BigDecimal("-0.55");
    /** Link value -0.48. */
    private static final BigDecimal LINK_VALUE_NEG_0_48 = new BigDecimal("-0.48");

    /**
     * Generates a mock sector network DTO.
     *
     * @param positiveLinkType the link type for positive correlations
     * @param negativeLinkType the link type for negative correlations
     * @return the sector network DTO
     */
    public SectorNetworkDto generate(String positiveLinkType, String negativeLinkType) {
        return SectorNetworkDto.builder()
                .nodes(buildMockSectorNodes())
                .links(buildMockSectorLinks(positiveLinkType, negativeLinkType))
                .build();
    }

    private List<SectorNetworkDto.SectorNode> buildMockSectorNodes() {
        return List.of(
            SectorNetworkDto.SectorNode.builder().id("1").name("新能源")
                    .marketCap(MARKET_CAP_8500).flow(FLOW_67_3).change(CHANGE_3_2)
                    .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("2").name("锂电池")
                    .marketCap(MARKET_CAP_4200).flow(FLOW_34_2).change(CHANGE_2_8)
                    .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("3").name("光伏")
                    .marketCap(MARKET_CAP_3800).flow(FLOW_28_5).change(CHANGE_2_1)
                    .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("4").name("储能")
                    .marketCap(MARKET_CAP_2900).flow(FLOW_15_8).change(CHANGE_1_9)
                    .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("5").name("银行")
                    .marketCap(MARKET_CAP_12000).flow(FLOW_45_2).change(CHANGE_1_2)
                    .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("6").name("保险")
                    .marketCap(MARKET_CAP_5600).flow(FLOW_12_3).change(CHANGE_0_8)
                    .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("7").name("证券")
                    .marketCap(MARKET_CAP_4800).flow(FLOW_NEG_8_5).change(CHANGE_NEG_0_5)
                    .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("8").name("科技")
                    .marketCap(MARKET_CAP_9200).flow(FLOW_NEG_67_5).change(CHANGE_NEG_2_8)
                    .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("9").name("半导体")
                    .marketCap(MARKET_CAP_6500).flow(FLOW_NEG_45_2).change(CHANGE_NEG_2_1)
                    .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("10").name("软件")
                    .marketCap(MARKET_CAP_3800).flow(FLOW_NEG_22_3).change(CHANGE_NEG_1_5)
                    .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("11").name("医药")
                    .marketCap(MARKET_CAP_7200).flow(FLOW_NEG_12_1).change(CHANGE_NEG_0_8)
                    .group(SECTOR_NODE_GROUP_4).build(),
            SectorNetworkDto.SectorNode.builder().id("12").name("医疗器械")
                    .marketCap(MARKET_CAP_3400).flow(FLOW_8_5).change(CHANGE_0_5)
                    .group(SECTOR_NODE_GROUP_4).build(),
            SectorNetworkDto.SectorNode.builder().id("13").name("消费")
                    .marketCap(MARKET_CAP_6800).flow(FLOW_23_4).change(CHANGE_1_5)
                    .group(SECTOR_NODE_GROUP_5).build(),
            SectorNetworkDto.SectorNode.builder().id("14").name("白酒")
                    .marketCap(MARKET_CAP_5200).flow(FLOW_18_9).change(CHANGE_1_2)
                    .group(SECTOR_NODE_GROUP_5).build(),
            SectorNetworkDto.SectorNode.builder().id("15").name("汽车")
                    .marketCap(MARKET_CAP_5800).flow(FLOW_15_6).change(CHANGE_0_9)
                    .group(SECTOR_NODE_GROUP_6).build(),
            SectorNetworkDto.SectorNode.builder().id("16").name("军工")
                    .marketCap(MARKET_CAP_4200).flow(FLOW_12_8).change(CHANGE_0_7)
                    .group(SECTOR_NODE_GROUP_7).build(),
            SectorNetworkDto.SectorNode.builder().id("17").name("地产")
                    .marketCap(MARKET_CAP_3600).flow(FLOW_NEG_45_6).change(CHANGE_NEG_3_2)
                    .group(SECTOR_NODE_GROUP_8).build(),
            SectorNetworkDto.SectorNode.builder().id("18").name("建材")
                    .marketCap(MARKET_CAP_2800).flow(FLOW_NEG_18_9).change(CHANGE_NEG_1_8)
                    .group(SECTOR_NODE_GROUP_8).build()
        );
    }

    private List<SectorNetworkDto.SectorLink> buildMockSectorLinks(String positiveLinkType,
            String negativeLinkType) {
        return List.of(
            SectorNetworkDto.SectorLink.builder().source("1").target("2")
                    .value(LINK_VALUE_0_85).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("3")
                    .value(LINK_VALUE_0_78).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("4")
                    .value(LINK_VALUE_0_72).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("3")
                    .value(LINK_VALUE_0_65).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("6")
                    .value(LINK_VALUE_0_68).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("7")
                    .value(LINK_VALUE_0_55).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("9")
                    .value(LINK_VALUE_0_82).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("10")
                    .value(LINK_VALUE_0_75).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("9").target("10")
                    .value(LINK_VALUE_0_70).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("11").target("12")
                    .value(LINK_VALUE_0_62).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("13").target("14")
                    .value(LINK_VALUE_0_58).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("8")
                    .value(LINK_VALUE_NEG_0_65).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("5")
                    .value(LINK_VALUE_NEG_0_45).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("8")
                    .value(LINK_VALUE_NEG_0_55).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("9")
                    .value(LINK_VALUE_NEG_0_48).type(negativeLinkType).build()
        );
    }
}
