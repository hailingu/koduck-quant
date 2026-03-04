package com.koduck.service;

import com.koduck.dto.dashboard.*;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Trade;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.repository.TradeRepository;
import com.koduck.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 仪表盘服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final PortfolioPositionRepository positionRepository;
    private final WatchlistRepository watchlistRepository;
    private final StrategyRepository strategyRepository;
    private final TradeRepository tradeRepository;

    /**
     * 获取资产概览
     */
    public DashboardSummaryDto getSummary(Long userId) {
        log.debug("Getting dashboard summary for user: {}", userId);
        
        // 获取所有持仓
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        // 计算总资产和总成本
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;
        
        for (PortfolioPosition position : positions) {
            // 模拟实时价格（实际应从数据服务获取）
            BigDecimal currentPrice = position.getAvgCost().multiply(new BigDecimal("1.05"));
            BigDecimal marketValue = currentPrice.multiply(position.getQuantity());
            BigDecimal cost = position.getAvgCost().multiply(position.getQuantity());
            
            totalCost = totalCost.add(cost);
            totalMarketValue = totalMarketValue.add(marketValue);
        }
        
        // 计算累计收益
        BigDecimal totalProfit = totalMarketValue.subtract(totalCost);
        BigDecimal profitRate = totalCost.compareTo(BigDecimal.ZERO) > 0 
            ? totalProfit.divide(totalCost, 4, RoundingMode.HALF_UP) 
            : BigDecimal.ZERO;
        
        // 模拟今日收益（实际应计算）
        BigDecimal todayProfit = totalProfit.multiply(new BigDecimal("0.02"));
        BigDecimal todayProfitRate = totalMarketValue.compareTo(BigDecimal.ZERO) > 0
            ? todayProfit.divide(totalMarketValue, 4, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        // 获取统计数据
        Integer positionCount = positions.size();
        Integer watchlistCount = (int) watchlistRepository.countByUserId(userId);
        Integer strategyCount = (int) strategyRepository.countByUserId(userId);
        
        return DashboardSummaryDto.builder()
            .totalAssets(totalMarketValue)
            .totalProfit(totalProfit)
            .profitRate(profitRate)
            .todayProfit(todayProfit)
            .todayProfitRate(todayProfitRate)
            .positionCount(positionCount)
            .watchlistCount(watchlistCount)
            .strategyCount(strategyCount)
            .build();
    }

    /**
     * 获取收益趋势
     */
    public ProfitTrendDto getProfitTrend(Long userId, Integer days) {
        log.debug("Getting profit trend for user: {}, days: {}", userId, days);
        
        List<ProfitTrendDto.DailyProfit> data = new ArrayList<>();
        LocalDate endDate = LocalDate.now();
        // LocalDate startDate = endDate.minusDays(days);  // unused, removed
        
        // 模拟数据（实际应从历史数据计算）
        BigDecimal baseAssets = new BigDecimal("100000");
        for (int i = days; i >= 0; i--) {
            LocalDate date = endDate.minusDays(i);
            // 模拟波动
            double random = Math.random() * 0.04 - 0.02; // -2% ~ +2%
            BigDecimal profitRate = BigDecimal.valueOf(random).setScale(4, RoundingMode.HALF_UP);
            BigDecimal profit = baseAssets.multiply(profitRate);
            BigDecimal totalAssets = baseAssets.add(profit);
            
            data.add(new ProfitTrendDto.DailyProfit(date, profit, profitRate, totalAssets));
            baseAssets = totalAssets;
        }
        
        return ProfitTrendDto.builder()
            .data(data)
            .build();
    }

    /**
     * 获取持仓分布
     */
    public AssetAllocationDto getAssetAllocation(Long userId) {
        log.debug("Getting asset allocation for user: {}", userId);
        
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        
        // 按市场分布
        Map<String, BigDecimal> marketValues = positions.stream()
            .collect(Collectors.groupingBy(
                PortfolioPosition::getMarket,
                Collectors.reducing(BigDecimal.ZERO, 
                    p -> p.getAvgCost().multiply(p.getQuantity()).multiply(new BigDecimal("1.05")),
                    BigDecimal::add)
            ));
        
        BigDecimal totalValue = marketValues.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        List<AssetAllocationDto.MarketAllocation> byMarket = marketValues.entrySet().stream()
            .map(entry -> {
                BigDecimal percentage = totalValue.compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue().divide(totalValue, 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
                return new AssetAllocationDto.MarketAllocation(
                    entry.getKey(),
                    getMarketName(entry.getKey()),
                    entry.getValue(),
                    percentage
                );
            })
            .sorted((a, b) -> b.percentage().compareTo(a.percentage()))
            .toList();  // Stream.toList returns an unmodifiable List (Java 16+)
        
        // Top 持仓
        List<AssetAllocationDto.PositionAllocation> topPositions = positions.stream()
            .map(p -> {
                BigDecimal currentPrice = p.getAvgCost().multiply(new BigDecimal("1.05"));
                BigDecimal marketValue = currentPrice.multiply(p.getQuantity());
                BigDecimal cost = p.getAvgCost().multiply(p.getQuantity());
                BigDecimal profit = marketValue.subtract(cost);
                BigDecimal profitRate = cost.compareTo(BigDecimal.ZERO) > 0
                    ? profit.divide(cost, 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
                BigDecimal percentage = totalValue.compareTo(BigDecimal.ZERO) > 0
                    ? marketValue.divide(totalValue, 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
                
                return new AssetAllocationDto.PositionAllocation(
                    p.getSymbol(),
                    p.getName(),
                    marketValue,
                    percentage,
                    profit,
                    profitRate
                );
            })
            .sorted((a, b) -> b.percentage().compareTo(a.percentage()))
            .limit(5)
            .toList();  // unmodifiable list from Stream
        
        return AssetAllocationDto.builder()
            .byMarket(byMarket)
            .topPositions(topPositions)
            .build();
    }

    /**
     * 获取最近动态
     */
    public RecentActivityDto getRecentActivities(Long userId) {
        log.debug("Getting recent activities for user: {}", userId);
        
        List<RecentActivityDto.ActivityItem> activities = new ArrayList<>();
        
        // 获取最近交易
        List<Trade> trades = tradeRepository.findByUserIdOrderByTradeTimeDesc(userId);
        trades.stream().limit(3).forEach(trade -> activities.add(
            new RecentActivityDto.ActivityItem(
                trade.getId(),
                "TRADE",
                "交易 " + trade.getTradeType(),
                trade.getSymbol() + " " + trade.getQuantity() + " 股",
                trade.getSymbol(),
                trade.getAmount(),
                trade.getTradeTime()
            )
        ));
        
        // 按时间排序
        activities.sort((a, b) -> b.createdAt().compareTo(a.createdAt()));
        
        return RecentActivityDto.builder()
            .activities(activities)
            .build();
    }

    /**
     * 获取快捷入口
     */
    public QuickLinkDto getQuickLinks(Long userId) {
        log.debug("Getting quick links for user: {}", userId);
        
        // 默认快捷入口
        List<QuickLinkDto.QuickLinkItem> links = List.of(
            new QuickLinkDto.QuickLinkItem(1L, "自选股", "Star", "/watchlist", 1),
            new QuickLinkDto.QuickLinkItem(2L, "投资组合", "PieChart", "/portfolio", 2),
            new QuickLinkDto.QuickLinkItem(3L, "K线图表", "Candlestick", "/chart", 3),
            new QuickLinkDto.QuickLinkItem(4L, "回测", "Play", "/backtest", 4),
            new QuickLinkDto.QuickLinkItem(5L, "策略", "Strategy", "/strategy", 5)
        );
        
        return QuickLinkDto.builder()
            .links(links)
            .build();
    }

    private String getMarketName(String market) {
        return switch (market.toUpperCase()) {
            case "US" -> "美股";
            case "SH" -> "上证";
            case "SZ" -> "深证";
            case "HK" -> "港股";
            default -> market;
        };
    }
}
