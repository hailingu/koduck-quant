package com.koduck.dto.community;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalListResponse {

    private List<SignalResponse> items;
    private long total;
    private int page;
    private int size;
    private int totalPages;
}
