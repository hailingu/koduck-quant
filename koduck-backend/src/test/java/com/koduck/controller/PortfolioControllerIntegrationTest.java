package com.koduck.controller;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.AbstractIntegrationTest;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.dto.portfolio.AddPositionRequest;
import com.koduck.dto.portfolio.AddTradeRequest;
import com.koduck.dto.portfolio.PortfolioPositionDto;
import com.koduck.dto.portfolio.PortfolioSummaryDto;
import com.koduck.dto.portfolio.TradeDto;
import com.koduck.dto.portfolio.UpdatePositionRequest;
import com.koduck.entity.PortfolioPosition;
import com.koduck.entity.Trade;
import com.koduck.repository.PortfolioPositionRepository;
import com.koduck.repository.TradeRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for {@link PortfolioController}.
 * <p>Tests portfolio management endpoints including positions, 
 * trades, and summary operations.</p>
 *
 * @author GitHub Copilot
 * @date 2026-04-01
 */
@AutoConfigureMockMvc
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class PortfolioControllerIntegrationTest extends AbstractIntegrationTest {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;
    private final PortfolioPositionRepository positionRepository;
    private final TradeRepository tradeRepository;

    private String accessToken;
    private Long userId;

    @Autowired
    PortfolioControllerIntegrationTest(
            MockMvc mockMvc,
            ObjectMapper objectMapper,
            PortfolioPositionRepository positionRepository,
            TradeRepository tradeRepository) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
        this.positionRepository = positionRepository;
        this.tradeRepository = tradeRepository;
    }

    @BeforeEach
    void setUp() throws Exception {
        // Clean test data
        tradeRepository.deleteAll();
        positionRepository.deleteAll();

        // Register and login a test user
        String suffix = Long.toString(System.nanoTime());
        RegisteredUser user = registerUser("portfoliouser_" + suffix, "password123", "Portfolio Test User");
        accessToken = user.accessToken();
        userId = user.userId();
    }

    // ==================== Helper Methods ====================

    private String bearerToken(String token) {
        return BEARER_PREFIX + token;
    }

    private RegisteredUser registerUser(String username, String password, String nickname) throws Exception {
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setUsername(username);
        registerRequest.setEmail(username + "@example.com");
        registerRequest.setPassword(password);
        registerRequest.setConfirmPassword(password);
        registerRequest.setNickname(nickname);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<TokenResponse> response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, TokenResponse.class));

        TokenResponse tokenResponse = response.getData();
        return new RegisteredUser(tokenResponse.getAccessToken(), tokenResponse.getUser().getId(), username);
    }

    private record RegisteredUser(String accessToken, Long userId, String username) {
    }

    // ==================== Get Positions Tests ====================

    @Test
    @DisplayName("获取持仓列表-空列表")
    void getPositionsEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("获取持仓列表-有数据")
    void getPositionsWithData() throws Exception {
        // Prepare test data
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .quantity(new BigDecimal("100"))
                .avgCost(new BigDecimal("1500.00"))
                .build();
        positionRepository.save(position);

        mockMvc.perform(get("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].symbol").value("600519"))
                .andExpect(jsonPath("$.data[0].name").value("贵州茅台"))
                .andExpect(jsonPath("$.data[0].quantity").value(100))
                .andExpect(jsonPath("$.data[0].avgCost").value(1500.00));
    }

    @Test
    @DisplayName("获取持仓列表-未授权")
    void getPositionsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio"))
                .andExpect(status().isUnauthorized());
    }

    // ==================== Get Portfolio Summary Tests ====================

    @Test
    @DisplayName("获取投资组合摘要-空组合")
    void getPortfolioSummaryEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio/summary")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.totalCost").value(0))
                .andExpect(jsonPath("$.data.totalMarketValue").value(0))
                .andExpect(jsonPath("$.data.totalPnl").value(0));
    }

    @Test
    @DisplayName("获取投资组合摘要-有持仓")
    void getPortfolioSummaryWithPositions() throws Exception {
        // Prepare test data
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.50"))
                .build();
        positionRepository.save(position);

        mockMvc.perform(get("/api/v1/portfolio/summary")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.totalCost").exists())
                .andExpect(jsonPath("$.data.totalMarketValue").exists())
                .andExpect(jsonPath("$.data.totalPnl").exists());
    }

    // ==================== Add Position Tests ====================

    @Test
    @DisplayName("添加持仓-新股票")
    void addPositionNew() throws Exception {
        AddPositionRequest request = new AddPositionRequest(
                "AShare", "600519", "贵州茅台", 
                new BigDecimal("100"), new BigDecimal("1500.00")
        );

        mockMvc.perform(post("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.symbol").value("600519"))
                .andExpect(jsonPath("$.data.name").value("贵州茅台"))
                .andExpect(jsonPath("$.data.quantity").value(100))
                .andExpect(jsonPath("$.data.avgCost").value(1500.00));
    }

    @Test
    @DisplayName("添加持仓-已存在的股票-合并仓位")
    void addPositionExistingMerge() throws Exception {
        // First position
        PortfolioPosition existing = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("500"))
                .avgCost(new BigDecimal("12.00"))
                .build();
        positionRepository.save(existing);

        // Add more of the same stock
        AddPositionRequest request = new AddPositionRequest(
                "AShare", "000001", "平安银行", 
                new BigDecimal("500"), new BigDecimal("13.00")
        );

        mockMvc.perform(post("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.quantity").value(1000)); // 500 + 500
    }

    @Test
    @DisplayName("添加持仓-参数验证失败-空市场")
    void addPositionValidationEmptyMarket() throws Exception {
        AddPositionRequest request = new AddPositionRequest(
                "", "600519", "贵州茅台", 
                new BigDecimal("100"), new BigDecimal("1500.00")
        );

        mockMvc.perform(post("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("添加持仓-参数验证失败-无效数量")
    void addPositionValidationInvalidQuantity() throws Exception {
        AddPositionRequest request = new AddPositionRequest(
                "AShare", "600519", "贵州茅台", 
                new BigDecimal("-100"), new BigDecimal("1500.00")
        );

        mockMvc.perform(post("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    // ==================== Update Position Tests ====================

    @Test
    @DisplayName("更新持仓-成功")
    void updatePositionSuccess() throws Exception {
        // Prepare test data
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.50"))
                .build();
        PortfolioPosition saved = positionRepository.save(position);

        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("2000"), new BigDecimal("13.00")
        );

        mockMvc.perform(put("/api/v1/portfolio/{id}", saved.getId())
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.quantity").value(2000))
                .andExpect(jsonPath("$.data.avgCost").value(13.00));
    }

    @Test
    @DisplayName("更新持仓-不存在")
    void updatePositionNotFound() throws Exception {
        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("2000"), new BigDecimal("13.00")
        );

        mockMvc.perform(put("/api/v1/portfolio/{id}", 999999)
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(-1));
    }

    @Test
    @DisplayName("更新持仓-无效ID")
    void updatePositionInvalidId() throws Exception {
        UpdatePositionRequest request = new UpdatePositionRequest(
                new BigDecimal("2000"), new BigDecimal("13.00")
        );

        mockMvc.perform(put("/api/v1/portfolio/{id}", -1)
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    // ==================== Delete Position Tests ====================

    @Test
    @DisplayName("删除持仓-成功")
    void deletePositionSuccess() throws Exception {
        // Prepare test data
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.50"))
                .build();
        PortfolioPosition saved = positionRepository.save(position);

        mockMvc.perform(delete("/api/v1/portfolio/{id}", saved.getId())
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Verify deletion
        assertThat(positionRepository.findById(saved.getId())).isEmpty();
    }

    @Test
    @DisplayName("删除持仓-不存在静默处理")
    void deletePositionNotFound() throws Exception {
        mockMvc.perform(delete("/api/v1/portfolio/{id}", 999999)
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    // ==================== Get Trades Tests ====================

    @Test
    @DisplayName("获取交易记录-空列表")
    void getTradesEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("获取交易记录-有数据")
    void getTradesWithData() throws Exception {
        // Prepare test data
        Trade trade = Trade.builder()
                .userId(userId)
                .market("AShare")
                .symbol("600519")
                .name("贵州茅台")
                .tradeType(Trade.TradeType.BUY)
                .quantity(new BigDecimal("100"))
                .price(new BigDecimal("1500.00"))
                .amount(new BigDecimal("150000.00"))
                .tradeTime(LocalDateTime.now())
                .build();
        tradeRepository.save(trade);

        mockMvc.perform(get("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].symbol").value("600519"))
                .andExpect(jsonPath("$.data[0].tradeType").value("BUY"));
    }

    // ==================== Add Trade Tests ====================

    @Test
    @DisplayName("添加交易记录-买入-创建新持仓")
    void addTradeBuyCreatePosition() throws Exception {
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "BUY",
                new BigDecimal("100"), new BigDecimal("1500.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.symbol").value("600519"))
                .andExpect(jsonPath("$.data.tradeType").value("BUY"))
                .andExpect(jsonPath("$.data.quantity").value(100))
                .andExpect(jsonPath("$.data.price").value(1500.00));

        // Verify position was created
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        assertThat(positions).hasSize(1);
        assertThat(positions.get(0).getSymbol()).isEqualTo("600519");
        assertThat(positions.get(0).getQuantity()).isEqualByComparingTo(new BigDecimal("100"));
    }

    @Test
    @DisplayName("添加交易记录-买入-更新现有持仓")
    void addTradeBuyUpdatePosition() throws Exception {
        // Prepare existing position
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.00"))
                .build();
        positionRepository.save(position);

        AddTradeRequest request = new AddTradeRequest(
                "AShare", "000001", "平安银行", "BUY",
                new BigDecimal("500"), new BigDecimal("13.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Verify position was updated
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        assertThat(positions).hasSize(1);
        assertThat(positions.get(0).getQuantity()).isEqualByComparingTo(new BigDecimal("1500")); // 1000 + 500
    }

    @Test
    @DisplayName("添加交易记录-卖出-减少持仓")
    void addTradeSellReducePosition() throws Exception {
        // Prepare existing position
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.00"))
                .build();
        positionRepository.save(position);

        AddTradeRequest request = new AddTradeRequest(
                "AShare", "000001", "平安银行", "SELL",
                new BigDecimal("400"), new BigDecimal("14.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Verify position was reduced
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        assertThat(positions).hasSize(1);
        assertThat(positions.get(0).getQuantity()).isEqualByComparingTo(new BigDecimal("600")); // 1000 - 400
    }

    @Test
    @DisplayName("添加交易记录-卖出全部-删除持仓")
    void addTradeSellAllDeletePosition() throws Exception {
        // Prepare existing position
        PortfolioPosition position = PortfolioPosition.builder()
                .userId(userId)
                .market("AShare")
                .symbol("000001")
                .name("平安银行")
                .quantity(new BigDecimal("1000"))
                .avgCost(new BigDecimal("12.00"))
                .build();
        positionRepository.save(position);

        AddTradeRequest request = new AddTradeRequest(
                "AShare", "000001", "平安银行", "SELL",
                new BigDecimal("1000"), new BigDecimal("14.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Verify position was deleted
        List<PortfolioPosition> positions = positionRepository.findByUserId(userId);
        assertThat(positions).isEmpty();
    }

    @Test
    @DisplayName("添加交易记录-参数验证失败-空市场")
    void addTradeValidationEmptyMarket() throws Exception {
        AddTradeRequest request = new AddTradeRequest(
                "", "600519", "贵州茅台", "BUY",
                new BigDecimal("100"), new BigDecimal("1500.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("添加交易记录-参数验证失败-无效交易类型")
    void addTradeValidationInvalidTradeType() throws Exception {
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "INVALID",
                new BigDecimal("100"), new BigDecimal("1500.00"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("添加交易记录-参数验证失败-价格为零")
    void addTradeValidationZeroPrice() throws Exception {
        AddTradeRequest request = new AddTradeRequest(
                "AShare", "600519", "贵州茅台", "BUY",
                new BigDecimal("100"), new BigDecimal("0"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    // ==================== End-to-End Flow Test ====================

    @Test
    @DisplayName("投资组合完整流程-增删改查")
    void portfolioEndToEndFlow() throws Exception {
        // Step 1: Add a position
        AddPositionRequest addRequest = new AddPositionRequest(
                "AShare", "600519", "贵州茅台", 
                new BigDecimal("100"), new BigDecimal("1500.00")
        );

        MvcResult addResult = mockMvc.perform(post("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andReturn();

        ApiResponse<PortfolioPositionDto> addResponse = objectMapper.readValue(
                addResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, PortfolioPositionDto.class));
        Long positionId = addResponse.getData().id();

        // Step 2: Get positions and verify
        mockMvc.perform(get("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1));

        // Step 3: Update the position
        UpdatePositionRequest updateRequest = new UpdatePositionRequest(
                new BigDecimal("200"), new BigDecimal("1550.00")
        );

        mockMvc.perform(put("/api/v1/portfolio/{id}", positionId)
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.quantity").value(200));

        // Step 4: Get summary
        mockMvc.perform(get("/api/v1/portfolio/summary")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Step 5: Add a trade
        AddTradeRequest tradeRequest = new AddTradeRequest(
                "AShare", "000001", "平安银行", "BUY",
                new BigDecimal("1000"), new BigDecimal("12.50"),
                LocalDateTime.now()
        );

        mockMvc.perform(post("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tradeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Step 6: Get trades
        mockMvc.perform(get("/api/v1/portfolio/trades")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1));

        // Step 7: Delete the first position
        mockMvc.perform(delete("/api/v1/portfolio/{id}", positionId)
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        // Step 8: Verify deletion
        mockMvc.perform(get("/api/v1/portfolio")
                        .header(AUTHORIZATION_HEADER, bearerToken(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(1)); // Only the trade-created position remains
    }
}
