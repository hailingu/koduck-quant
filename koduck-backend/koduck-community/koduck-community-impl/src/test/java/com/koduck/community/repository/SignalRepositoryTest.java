package com.koduck.community.repository;

import com.koduck.community.entity.Signal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.koduck.community.TestConfiguration;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SignalRepository 单元测试。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@DataJpaTest
@Import(TestConfiguration.class)
class SignalRepositoryTest {

    private static final Long USER_ID = 1L;
    private static final Long PORTFOLIO_ID = 10L;
    private static final String SYMBOL = "AAPL";

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private SignalRepository signalRepository;

    private Signal createTestSignal(Long userId, String symbol, Signal.SignalType type, 
                                     String title, Signal.Status status, int likeCount) {
        Signal signal = new Signal();
        signal.setUserId(userId);
        signal.setPortfolioId(PORTFOLIO_ID);
        signal.setSymbol(symbol);
        signal.setSignalType(type);
        signal.setTitle(title);
        signal.setContent("Test content for " + title);
        signal.setEntryPrice(new BigDecimal("150.00"));
        signal.setStatus(status);
        signal.setLikeCount(likeCount);
        signal.setCommentCount(0);
        signal.setViewCount(0);
        return signal;
    }

    @Test
    @DisplayName("应保存并查询信号")
    void shouldSaveAndFindSignal() {
        Signal signal = createTestSignal(USER_ID, SYMBOL, Signal.SignalType.BUY, 
                "Buy Signal", Signal.Status.ACTIVE, 0);
        
        Signal saved = entityManager.persistAndFlush(signal);
        
        Optional<Signal> found = signalRepository.findById(saved.getId());
        
        assertTrue(found.isPresent());
        assertEquals(SYMBOL, found.get().getSymbol());
        assertEquals("Buy Signal", found.get().getTitle());
    }

    @Test
    @DisplayName("应按用户ID查询信号")
    void shouldFindByUserId() {
        Signal signal1 = createTestSignal(USER_ID, "AAPL", Signal.SignalType.BUY, 
                "Signal 1", Signal.Status.ACTIVE, 0);
        Signal signal2 = createTestSignal(USER_ID, "MSFT", Signal.SignalType.SELL, 
                "Signal 2", Signal.Status.ACTIVE, 0);
        Signal signal3 = createTestSignal(2L, "GOOGL", Signal.SignalType.BUY, 
                "Signal 3", Signal.Status.ACTIVE, 0);
        
        entityManager.persist(signal1);
        entityManager.persist(signal2);
        entityManager.persist(signal3);
        entityManager.flush();
        
        Page<Signal> result = signalRepository.findByUserId(USER_ID, PageRequest.of(0, 10));
        
        assertEquals(2, result.getTotalElements());
    }

    @Test
    @DisplayName("应按投资组合ID查询信号")
    void shouldFindByPortfolioId() {
        Signal signal = createTestSignal(USER_ID, SYMBOL, Signal.SignalType.BUY, 
                "Portfolio Signal", Signal.Status.ACTIVE, 0);
        
        entityManager.persistAndFlush(signal);
        
        Page<Signal> result = signalRepository.findByPortfolioId(PORTFOLIO_ID, PageRequest.of(0, 10));
        
        assertEquals(1, result.getTotalElements());
    }

    @Test
    @DisplayName("应按状态查询信号")
    void shouldFindByStatus() {
        Signal activeSignal = createTestSignal(USER_ID, "AAPL", Signal.SignalType.BUY, 
                "Active", Signal.Status.ACTIVE, 0);
        Signal closedSignal = createTestSignal(USER_ID, "MSFT", Signal.SignalType.SELL, 
                "Closed", Signal.Status.CLOSED, 0);
        
        entityManager.persist(activeSignal);
        entityManager.persist(closedSignal);
        entityManager.flush();
        
        Page<Signal> result = signalRepository.findByStatus(Signal.Status.ACTIVE, PageRequest.of(0, 10));
        
        assertEquals(1, result.getTotalElements());
        assertEquals("Active", result.getContent().get(0).getTitle());
    }

    @Test
    @DisplayName("应统计用户的信号数量")
    void shouldCountByUserId() {
        Signal signal1 = createTestSignal(USER_ID, "AAPL", Signal.SignalType.BUY, 
                "Signal 1", Signal.Status.ACTIVE, 0);
        Signal signal2 = createTestSignal(USER_ID, "MSFT", Signal.SignalType.SELL, 
                "Signal 2", Signal.Status.ACTIVE, 0);
        
        entityManager.persist(signal1);
        entityManager.persist(signal2);
        entityManager.flush();
        
        long count = signalRepository.countByUserId(USER_ID);
        
        assertEquals(2, count);
    }

    @Test
    @DisplayName("应检查信号是否属于用户")
    void shouldCheckExistsByIdAndUserId() {
        Signal signal = createTestSignal(USER_ID, SYMBOL, Signal.SignalType.BUY, 
                "Test", Signal.Status.ACTIVE, 0);
        Signal saved = entityManager.persistAndFlush(signal);
        
        assertTrue(signalRepository.existsByIdAndUserId(saved.getId(), USER_ID));
        assertFalse(signalRepository.existsByIdAndUserId(saved.getId(), 999L));
        assertFalse(signalRepository.existsByIdAndUserId(999L, USER_ID));
    }

    @Test
    @DisplayName("应搜索信号")
    void shouldSearchByKeyword() {
        Signal signal1 = createTestSignal(USER_ID, "AAPL", Signal.SignalType.BUY, 
                "Apple Buy Signal", Signal.Status.ACTIVE, 0);
        Signal signal2 = createTestSignal(USER_ID, "MSFT", Signal.SignalType.SELL, 
                "Microsoft Sell", Signal.Status.ACTIVE, 0);
        
        entityManager.persist(signal1);
        entityManager.persist(signal2);
        entityManager.flush();
        
        Page<Signal> result = signalRepository.searchByKeyword("Apple", PageRequest.of(0, 10));
        
        assertEquals(1, result.getTotalElements());
        assertEquals("AAPL", result.getContent().get(0).getSymbol());
    }

    @Test
    @DisplayName("应查询热门信号")
    void shouldFindHotSignals() {
        Signal signal1 = createTestSignal(USER_ID, "AAPL", Signal.SignalType.BUY, 
                "Hot Signal", Signal.Status.ACTIVE, 100);
        Signal signal2 = createTestSignal(USER_ID, "MSFT", Signal.SignalType.SELL, 
                "Less Hot", Signal.Status.ACTIVE, 50);
        Signal signal3 = createTestSignal(USER_ID, "GOOGL", Signal.SignalType.BUY, 
                "Inactive", Signal.Status.CLOSED, 200);
        
        entityManager.persist(signal1);
        entityManager.persist(signal2);
        entityManager.persist(signal3);
        entityManager.flush();
        
        List<Signal> hotSignals = signalRepository.findHotSignals(PageRequest.of(0, 10));
        
        assertEquals(2, hotSignals.size());
        // 应该按点赞数排序，AAPL 应该在前面
        assertEquals("AAPL", hotSignals.get(0).getSymbol());
    }

    @Test
    @DisplayName("应删除信号")
    void shouldDeleteSignal() {
        Signal signal = createTestSignal(USER_ID, SYMBOL, Signal.SignalType.BUY, 
                "To Delete", Signal.Status.ACTIVE, 0);
        Signal saved = entityManager.persistAndFlush(signal);
        
        signalRepository.deleteById(saved.getId());
        
        Optional<Signal> found = signalRepository.findById(saved.getId());
        assertFalse(found.isPresent());
    }
}
