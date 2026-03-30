package com.koduck.dto.community;

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
public class SignalListResponse {

    @Singular
    private List<SignalResponse> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;

    public List<SignalResponse> getItems() {
        return CollectionCopyUtils.copyList(items);
    }

    public void setItems(List<SignalResponse> items) {
        this.items = CollectionCopyUtils.copyList(items);
    }
}
