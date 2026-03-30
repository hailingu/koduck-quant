package com.koduck.dto.common;

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
public class PageResponse<T> {

    @Singular("contentItem")
    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    public List<T> getContent() {
        return CollectionCopyUtils.copyList(content);
    }

    public void setContent(List<T> content) {
        this.content = CollectionCopyUtils.copyList(content);
    }
}
