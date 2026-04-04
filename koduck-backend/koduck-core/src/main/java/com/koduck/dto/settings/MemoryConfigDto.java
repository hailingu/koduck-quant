package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 记忆配置 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemoryConfigDto {

    /** 是否启用. */
    private Boolean enabled;

    /** 模式. */
    private String mode;

    /** 是否启用 L1. */
    private Boolean enableL1;

    /** 是否启用 L2. */
    private Boolean enableL2;

    /** 是否启用 L3. */
    private Boolean enableL3;
}
