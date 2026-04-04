package com.koduck.dto.common;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 通用分页响应数据传输对象。
 *
 * @param <T> the type of elements in the page
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class PageResponse<T> {

    /**
     * 当前页的内容列表。
     */
    private List<T> content;

    /**
     * 当前页码（从0开始）。
     */
    private int page;

    /**
     * 每页元素数量。
     */
    private int size;

    /**
     * 所有页面的元素总数。
     */
    private long totalElements;

    /**
     * 总页数。
     */
    private int totalPages;

    /**
     * 是否是第一页。
     */
    private boolean first;

    /**
     * 是否是最后一页。
     */
    private boolean last;

    /**
     * Constructs a PageResponse with all fields.
     *
     * @param content       the content list
     * @param page          the page number
     * @param size          the page size
     * @param totalElements 元素总数
     * @param totalPages    the total pages
     * @param first         whether first page
     * @param last          whether last page
     */
    public PageResponse(List<T> content, int page, int size, long totalElements,
                        int totalPages, boolean first, boolean last) {
        this.content = CollectionCopyUtils.copyList(content);
        this.page = page;
        this.size = size;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.first = first;
        this.last = last;
    }

    /**
     * 创建新的 Builder 实例。
     *
     * @param <T> 元素类型
     * @return 新的 Builder
     */
    public static <T> Builder<T> builder() {
        return new Builder<>();
    }

    /**
     * PageResponse 的构建器类。
     *
     * @param <T> 元素类型
     */
    public static final class Builder<T> {

        /**
         * 当前页的内容列表。
         */
        private List<T> content;

        /**
         * 当前页码（从0开始）。
         */
        private int page;

        /**
         * 每页元素数量。
         */
        private int size;

        /**
         * 所有页面的元素总数。
         */
        private long totalElements;

        /**
         * 总页数。
         */
        private int totalPages;

        /**
         * 是否是第一页。
         */
        private boolean first;

        /**
         * 是否是最后一页。
         */
        private boolean last;

        /**
         * 设置内容列表。
         *
         * @param content 内容
         * @return 此构建器
         */
        public Builder<T> content(List<T> content) {
            this.content = CollectionCopyUtils.copyList(content);
            return this;
        }

        /**
         * 设置页码。
         *
         * @param page 页码
         * @return 此构建器
         */
        public Builder<T> page(int page) {
            this.page = page;
            return this;
        }

        /**
         * 设置每页大小。
         *
         * @param size 每页大小
         * @return 此构建器
         */
        public Builder<T> size(int size) {
            this.size = size;
            return this;
        }

        /**
         * 设置元素总数。
         *
         * @param totalElements 元素总数
         * @return 此构建器
         */
        public Builder<T> totalElements(long totalElements) {
            this.totalElements = totalElements;
            return this;
        }

        /**
         * 设置总页数。
         *
         * @param totalPages 总页数
         * @return 此构建器
         */
        public Builder<T> totalPages(int totalPages) {
            this.totalPages = totalPages;
            return this;
        }

        /**
         * 设置是否是第一页。
         *
         * @param first 是否是第一页
         * @return 此构建器
         */
        public Builder<T> first(boolean first) {
            this.first = first;
            return this;
        }

        /**
         * 设置是否是最后一页。
         *
         * @param last 是否是最后一页
         * @return 此构建器
         */
        public Builder<T> last(boolean last) {
            this.last = last;
            return this;
        }

        /**
         * 构建 PageResponse 实例。
         *
         * @return PageResponse 实例
         */
        public PageResponse<T> build() {
            return new PageResponse<>(content, page, size, totalElements, totalPages, first, last);
        }
    }

    /**
     * 返回内容列表的防御性拷贝。
     *
     * @return the content list copy
     */
    public List<T> getContent() {
        return CollectionCopyUtils.copyList(content);
    }

    /**
     * 设置内容列表（防御性拷贝）。
     *
     * @param content 内容 list
     */
    public void setContent(List<T> content) {
        this.content = CollectionCopyUtils.copyList(content);
    }
}
