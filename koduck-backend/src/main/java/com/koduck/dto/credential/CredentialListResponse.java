package com.koduck.dto.credential;

import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class CredentialListResponse {

    private List<CredentialResponse> items;
    private long total;
    private int page;
    private int size;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private List<CredentialResponse> items;
        private long total;
        private int page;
        private int size;

        public Builder items(List<CredentialResponse> items) {
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

        public CredentialListResponse build() {
            CredentialListResponse response = new CredentialListResponse();
            response.setItems(items);
            response.setTotal(total);
            response.setPage(page);
            response.setSize(size);
            return response;
        }
    }

    public List<CredentialResponse> getItems() {
        return CollectionCopyUtils.copyList(items);
    }

    public void setItems(List<CredentialResponse> items) {
        this.items = CollectionCopyUtils.copyList(items);
    }
}
