package com.koduck.dto.credential;

import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Singular;

import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialListResponse {

    @Singular
    private List<CredentialResponse> items;
    private long total;
    private int page;
    private int size;

    public List<CredentialResponse> getItems() {
        return CollectionCopyUtils.copyList(items);
    }

    public void setItems(List<CredentialResponse> items) {
        this.items = CollectionCopyUtils.copyList(items);
    }
}
