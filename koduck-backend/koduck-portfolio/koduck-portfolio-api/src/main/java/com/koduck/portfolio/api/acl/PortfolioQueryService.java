package com.koduck.portfolio.api.acl;

import java.util.List;
import java.util.Optional;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import com.koduck.portfolio.dto.PortfolioSnapshot;

/**
 * 投资组合查询服务防腐层接口。
 *
 * <p>供其他领域模块（如 AI）查询投资组合数据使用。</p>
 *
 * <p>此接口提供简化的、只读的投资组合数据访问，隔离领域模型差异。</p>
 *
 * @author Koduck Team
 * @see com.koduck.portfolio.api.PortfolioQueryService
 */
public interface PortfolioQueryService {

    /**
     * 获取投资组合快照。
     *
     * <p>用于 AI 分析等场景。</p>
     *
     * @param portfolioId 投资组合ID
     * @return 投资组合快照，未找到时返回 {@link Optional#empty()}
     */
    Optional<PortfolioSnapshot> getSnapshot(@NotNull @Positive Long portfolioId);

    /**
     * 批量获取投资组合快照。
     *
     * @param portfolioIds 投资组合ID列表
     * @return 投资组合快照列表
     * @throws IllegalArgumentException 当 portfolioIds 为空列表时
     */
    List<PortfolioSnapshot> getSnapshots(@NotEmpty List<Long> portfolioIds);

    /**
     * 获取用户的所有投资组合快照。
     *
     * @param userId 用户ID
     * @return 投资组合快照列表
     */
    List<PortfolioSnapshot> getUserSnapshots(@NotNull @Positive Long userId);
}
