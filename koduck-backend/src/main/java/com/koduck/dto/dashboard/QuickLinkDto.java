package com.koduck.dto.dashboard;

import java.util.List;

/**
 * 快捷入口 DTO
 */
public record QuickLinkDto(
    List<QuickLinkItem> links
) {
    
    public record QuickLinkItem(
        Long id,              // ID
        String name,          // 名称
        String icon,          // 图标
        String path,          // 路径
        Integer sortOrder     // 排序
    ) {
    }
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private List<QuickLinkItem> links;
        
        public Builder links(List<QuickLinkItem> links) {
            this.links = links;
            return this;
        }
        
        public QuickLinkDto build() {
            return new QuickLinkDto(links);
        }
    }
}
