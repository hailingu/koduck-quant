package com.koduck.dto.common;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Generic page response DTO for paginated results.
 *
 * @param <T> the type of elements in the page
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class PageResponse<T> {

    /**
     * Content list of the current page.
     */
    private List<T> content;

    /**
     * Current page number (0-indexed).
     */
    private int page;

    /**
     * Number of elements per page.
     */
    private int size;

    /**
     * Total number of elements across all pages.
     */
    private long totalElements;

    /**
     * Total number of pages.
     */
    private int totalPages;

    /**
     * Whether this is the first page.
     */
    private boolean first;

    /**
     * Whether this is the last page.
     */
    private boolean last;

    /**
     * Constructs a PageResponse with all fields.
     *
     * @param content       the content list
     * @param page          the page number
     * @param size          the page size
     * @param totalElements the total elements
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
     * Creates a new Builder instance.
     *
     * @param <T> the element type
     * @return a new Builder
     */
    public static <T> Builder<T> builder() {
        return new Builder<>();
    }

    /**
     * Builder class for PageResponse.
     *
     * @param <T> the element type
     */
    public static final class Builder<T> {

        /**
         * Content list of the current page.
         */
        private List<T> content;

        /**
         * Current page number (0-indexed).
         */
        private int page;

        /**
         * Number of elements per page.
         */
        private int size;

        /**
         * Total number of elements across all pages.
         */
        private long totalElements;

        /**
         * Total number of pages.
         */
        private int totalPages;

        /**
         * Whether this is the first page.
         */
        private boolean first;

        /**
         * Whether this is the last page.
         */
        private boolean last;

        /**
         * Sets the content list.
         *
         * @param content the content
         * @return this builder
         */
        public Builder<T> content(List<T> content) {
            this.content = CollectionCopyUtils.copyList(content);
            return this;
        }

        /**
         * Sets the page number.
         *
         * @param page the page number
         * @return this builder
         */
        public Builder<T> page(int page) {
            this.page = page;
            return this;
        }

        /**
         * Sets the page size.
         *
         * @param size the page size
         * @return this builder
         */
        public Builder<T> size(int size) {
            this.size = size;
            return this;
        }

        /**
         * Sets the total elements count.
         *
         * @param totalElements the total elements
         * @return this builder
         */
        public Builder<T> totalElements(long totalElements) {
            this.totalElements = totalElements;
            return this;
        }

        /**
         * Sets the total pages count.
         *
         * @param totalPages the total pages
         * @return this builder
         */
        public Builder<T> totalPages(int totalPages) {
            this.totalPages = totalPages;
            return this;
        }

        /**
         * Sets whether this is the first page.
         *
         * @param first whether first page
         * @return this builder
         */
        public Builder<T> first(boolean first) {
            this.first = first;
            return this;
        }

        /**
         * Sets whether this is the last page.
         *
         * @param last whether last page
         * @return this builder
         */
        public Builder<T> last(boolean last) {
            this.last = last;
            return this;
        }

        /**
         * Builds the PageResponse instance.
         *
         * @return the PageResponse
         */
        public PageResponse<T> build() {
            return new PageResponse<>(content, page, size, totalElements, totalPages, first, last);
        }
    }

    /**
     * Returns a defensive copy of the content list.
     *
     * @return the content list copy
     */
    public List<T> getContent() {
        return CollectionCopyUtils.copyList(content);
    }

    /**
     * Sets the content list (defensive copy).
     *
     * @param content the content list
     */
    public void setContent(List<T> content) {
        this.content = CollectionCopyUtils.copyList(content);
    }
}
