package com.koduck.dto.common;

import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class PageResponse<T> {

    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    public PageResponse(List<T> content, int page, int size, long totalElements, int totalPages, boolean first, boolean last) {
        this.content = CollectionCopyUtils.copyList(content);
        this.page = page;
        this.size = size;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.first = first;
        this.last = last;
    }

    public static <T> Builder<T> builder() {
        return new Builder<>();
    }

    public static final class Builder<T> {

        private List<T> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;

        public Builder<T> content(List<T> content) {
            this.content = CollectionCopyUtils.copyList(content);
            return this;
        }

        public Builder<T> page(int page) {
            this.page = page;
            return this;
        }

        public Builder<T> size(int size) {
            this.size = size;
            return this;
        }

        public Builder<T> totalElements(long totalElements) {
            this.totalElements = totalElements;
            return this;
        }

        public Builder<T> totalPages(int totalPages) {
            this.totalPages = totalPages;
            return this;
        }

        public Builder<T> first(boolean first) {
            this.first = first;
            return this;
        }

        public Builder<T> last(boolean last) {
            this.last = last;
            return this;
        }

        public PageResponse<T> build() {
            return new PageResponse<>(content, page, size, totalElements, totalPages, first, last);
        }
    }

    public List<T> getContent() {
        return CollectionCopyUtils.copyList(content);
    }

    public void setContent(List<T> content) {
        this.content = CollectionCopyUtils.copyList(content);
    }
}
