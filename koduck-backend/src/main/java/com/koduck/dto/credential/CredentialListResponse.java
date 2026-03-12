package com.koduck.dto.credential;

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
public class CredentialListResponse {

    private List<CredentialResponse> items;
    private long total;
    private int page;
    private int size;
}
