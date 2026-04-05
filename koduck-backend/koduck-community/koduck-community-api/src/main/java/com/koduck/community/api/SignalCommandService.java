package com.koduck.community.api;

import com.koduck.community.dto.SignalDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 信号命令服务接口。
 *
 * <p>提供信号的创建、更新、删除操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface SignalCommandService {

    /**
     * 发布信号。
     *
     * @param userId 用户ID
     * @param dto 信号数据
     * @return 创建后的信号
     */
    SignalDto publishSignal(@NotNull @Positive Long userId, @Valid SignalDto dto);

    /**
     * 更新信号。
     *
     * @param signalId 信号ID
     * @param dto 更新的信号数据
     * @return 更新后的信号
     */
    SignalDto updateSignal(@NotNull @Positive Long signalId, @Valid SignalDto dto);

    /**
     * 删除信号。
     *
     * @param signalId 信号ID
     */
    void deleteSignal(@NotNull @Positive Long signalId);

    /**
     * 关闭信号。
     *
     * @param signalId 信号ID
     */
    void closeSignal(@NotNull @Positive Long signalId);

    /**
     * 增加浏览次数。
     *
     * @param signalId 信号ID
     */
    void incrementViewCount(@NotNull @Positive Long signalId);
}
