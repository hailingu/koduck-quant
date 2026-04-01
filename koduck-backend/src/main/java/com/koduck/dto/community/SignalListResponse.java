package com.koduck.dto.community;

import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class SignalListResponse {

    private List<SignalResponse> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private List<SignalResponse> items;
        private long total;
        private int page;
        private int size;
        private int totalPages;

        public Builder items(List<SignalResponse> items) {
            this.items = CollectionCopyUtils.copyList(items);
            return this;
        }

        public Builder total(long total) {
            this.total = total;
            return this;
        }

        public Builder page(int page) {
            this.page = page;
            return this;
        }

        public Builder size(int size) {
            this.size = size;
            return this;
        }

        public Builder totalPages(int totalPages) {
            this.totalPages = totalPages;
            return this;
        }

        public SignalListResponse build() {
            SignalListResponse response = new SignalListResponse();
            response.setItems(items);
            response.setTotal(total);
            response.setPage(page);
            response.setSize(size);
            response.setTotalPages(totalPages);
            return response;
        }
    }

    public List<SignalResponse> getItems() {
        return CollectionCopyUtils.copyList(items);
    }

    public void setItems(List<SignalResponse> items) {
        this.items = CollectionCopyUtils.copyList(items);
    }
}
