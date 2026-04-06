package com.koduck.strategy.service;

import java.util.List;

import com.koduck.strategy.dto.CreateStrategyRequest;
import com.koduck.strategy.dto.StrategyDto;
import com.koduck.strategy.dto.StrategyVersionDto;
import com.koduck.strategy.dto.UpdateStrategyRequest;

/**
 * 策略操作服务接口。
 *
 * @author Koduck Team
 */
public interface StrategyService {

    /**
     * 获取用户的所有策略。
     *
     * @param userId 用户ID
     * @return 策略列表
     */
    List<StrategyDto> getStrategies(Long userId);

    /**
     * 根据ID获取策略。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @return 策略
     */
    StrategyDto getStrategy(Long userId, Long strategyId);

    /**
     * 创建新策略。
     *
     * @param userId  用户ID
     * @param request 创建请求
     * @return 创建的策略
     */
    StrategyDto createStrategy(Long userId, CreateStrategyRequest request);

    /**
     * 更新策略。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @param request    更新请求
     * @return 更新后的策略
     */
    StrategyDto updateStrategy(Long userId, Long strategyId, UpdateStrategyRequest request);

    /**
     * 删除策略。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     */
    void deleteStrategy(Long userId, Long strategyId);

    /**
     * 发布策略。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @return 发布后的策略
     */
    StrategyDto publishStrategy(Long userId, Long strategyId);

    /**
     * 禁用策略。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @return 禁用后的策略
     */
    StrategyDto disableStrategy(Long userId, Long strategyId);

    /**
     * 获取策略的版本列表。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @return 策略版本列表
     */
    List<StrategyVersionDto> getVersions(Long userId, Long strategyId);

    /**
     * 获取特定版本。
     *
     * @param userId        用户ID
     * @param strategyId    策略ID
     * @param versionNumber 版本号
     * @return 策略版本
     */
    StrategyVersionDto getVersion(Long userId, Long strategyId, Integer versionNumber);

    /**
     * 激活特定版本。
     *
     * @param userId     用户ID
     * @param strategyId 策略ID
     * @param versionId  版本ID
     * @return 激活的策略版本
     */
    StrategyVersionDto activateVersion(Long userId, Long strategyId, Long versionId);
}
