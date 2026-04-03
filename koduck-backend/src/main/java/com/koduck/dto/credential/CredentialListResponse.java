package com.koduck.dto.credential;

import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 凭证列表响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class CredentialListResponse {

    /** 凭证列表. */
    private List<CredentialResponse> items;

    /** 总数. */
    private long total;

    /** 页码. */
    private int page;

    /** 每页大小. */
    private int size;

    /**
     * 创建 Builder。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder 类。
     */
    public static final class Builder {

        /** 凭证列表. */
        private List<CredentialResponse> items;

        /** 总数. */
        private long total;

        /** 页码. */
        private int page;

        /** 每页大小. */
        private int size;

        /**
         * 设置凭证列表。
         *
         * @param itemsParam 凭证列表
         * @return Builder 实例
         */
        public Builder items(List<CredentialResponse> itemsParam) {
            this.items = CollectionCopyUtils.copyList(itemsParam);
            return this;
        }

        /**
         * 设置总数。
         *
         * @param totalParam 总数
         * @return Builder 实例
         */
        public Builder total(long totalParam) {
            this.total = totalParam;
            return this;
        }

        /**
         * 设置页码。
         *
         * @param pageParam 页码
         * @return Builder 实例
         */
        public Builder page(int pageParam) {
            this.page = pageParam;
            return this;
        }

        /**
         * 设置每页大小。
         *
         * @param sizeParam 每页大小
         * @return Builder 实例
         */
        public Builder size(int sizeParam) {
            this.size = sizeParam;
            return this;
        }

        /**
         * 构建 CredentialListResponse。
         *
         * @return CredentialListResponse 实例
         */
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

    public void setItems(List<CredentialResponse> itemsParam) {
        this.items = CollectionCopyUtils.copyList(itemsParam);
    }
}
