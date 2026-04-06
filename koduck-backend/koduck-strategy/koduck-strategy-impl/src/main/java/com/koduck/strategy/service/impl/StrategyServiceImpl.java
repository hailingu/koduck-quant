package com.koduck.strategy.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.common.constants.MarketConstants;
import com.koduck.strategy.dto.CreateStrategyRequest;
import com.koduck.strategy.dto.StrategyDto;
import com.koduck.strategy.dto.StrategyParameterDto;
import com.koduck.strategy.dto.StrategyParameterRequest;
import com.koduck.strategy.dto.StrategyVersionDto;
import com.koduck.strategy.dto.UpdateStrategyRequest;
import com.koduck.strategy.entity.strategy.Strategy;
import com.koduck.strategy.entity.strategy.StrategyParameter;
import com.koduck.strategy.entity.strategy.StrategyVersion;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.strategy.mapper.StrategyMapper;
import com.koduck.strategy.repository.strategy.StrategyParameterRepository;
import com.koduck.strategy.repository.strategy.StrategyRepository;
import com.koduck.strategy.repository.strategy.StrategyVersionRepository;
import com.koduck.strategy.service.StrategyService;
import com.koduck.strategy.service.support.StrategyAccessSupport;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Implementation of StrategyService.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class StrategyServiceImpl implements StrategyService {

    private static final String DEFAULT_TEMPLATE_SYMBOL = MarketConstants.A_SHARE_INDEX_SYMBOL;
    private static final String TEMPLATE_SYMBOL_PLACEHOLDER = "__DEFAULT_SYMBOL__";
    private static final String TEMPLATE_MARKET_PLACEHOLDER = "__DEFAULT_MARKET__";

    private final StrategyRepository strategyRepository;

    private final StrategyVersionRepository versionRepository;

    private final StrategyParameterRepository parameterRepository;

    private final StrategyMapper strategyMapper;

    private final StrategyAccessSupport strategyAccessSupport;

    private static final String DEFAULT_CODE_TEMPLATE = buildDefaultCodeTemplate();

    private static String buildDefaultCodeTemplate() {
        return """
#
# Python
def initialize(context):
    # Set the default symbol and market.
    context.symbol = "__DEFAULT_SYMBOL__"
    context.market = "__DEFAULT_MARKET__"
def handle_data(context, data):
    # Read the current price.
    current_price = data.get_price(context.symbol)
    # Check the current position.
    position = context.portfolio.get_position(context.symbol)
    # Calculate moving averages.
    ma20 = data.get_ma(context.symbol, 20)
    ma60 = data.get_ma(context.symbol, 60)
    if ma20 > ma60 and position == 0:
        # Buy when the short-term trend turns positive.
        context.order_buy(context.symbol, 100)
    elif ma20 < ma60 and position > 0:
        # Sell when the trend weakens.
        context.order_sell(context.symbol, position)
"""
            .replace(TEMPLATE_SYMBOL_PLACEHOLDER, DEFAULT_TEMPLATE_SYMBOL)
            .replace(TEMPLATE_MARKET_PLACEHOLDER, MarketConstants.DEFAULT_MARKET);
    }
    @Override
    public List<StrategyDto> getStrategies(Long userId) {
        log.debug("Getting strategies for user: {}", userId);
        List<Strategy> strategies = strategyRepository.findByUserId(userId);
        return strategies.stream()
            .map(strategyMapper::toStrategyDto)
            .toList();
    }
    @Override
    public StrategyDto getStrategy(Long userId, Long strategyId) {
        log.debug("Getting strategy: user={}, strategyId={}", userId, strategyId);
        Strategy strategy = strategyAccessSupport.loadStrategyOrThrow(userId, strategyId);
        return convertToDtoWithParameters(strategy);
    }
    @Override
    @Transactional
    public StrategyDto createStrategy(Long userId, CreateStrategyRequest request) {
        log.debug("Creating strategy: user={}, name={}", userId, request.name());
        // Create strategy
        Strategy strategy = Strategy.builder()
            .userId(userId)
            .name(request.name())
            .description(request.description())
            .status(Strategy.StrategyStatus.DRAFT)
            .currentVersion(1)
            .build();
        Strategy savedStrategy = strategyRepository.save(Objects.requireNonNull(strategy, "strategy must not be null"));
        // Create initial version
        StrategyVersion version = StrategyVersion.builder()
            .strategyId(savedStrategy.getId())
            .versionNumber(1)
            .code(request.code() != null ? request.code() : DEFAULT_CODE_TEMPLATE)
            .changelog("Initial version")
            .isActive(true)
            .build();
        versionRepository.save(Objects.requireNonNull(version, "version must not be null"));
        // Create parameters if provided
        if (request.parameters() != null && !request.parameters().isEmpty()) {
            saveParameters(savedStrategy.getId(), request.parameters());
        }
        log.info("Created strategy: id={}, user={}, name={}", savedStrategy.getId(), userId, request.name());
        return convertToDtoWithParameters(savedStrategy);
    }
    @Override
    @Transactional
    public StrategyDto updateStrategy(Long userId, Long strategyId, UpdateStrategyRequest request) {
        log.debug("Updating strategy: user={}, strategyId={}", userId, strategyId);
        Strategy strategy = strategyAccessSupport.loadStrategyOrThrow(userId, strategyId);
        // Update basic info
        if (request.name() != null) {
            strategy.setName(request.name());
        }
        if (request.description() != null) {
            strategy.setDescription(request.description());
        }
        Strategy savedStrategy = strategyRepository.save(Objects.requireNonNull(strategy, "strategy must not be null"));
        // Create new version if code is provided
        if (request.code() != null && !request.code().isEmpty()) {
            createNewVersion(strategyId, request.code(), request.changelog());
        }
        // Update parameters if provided
        if (request.parameters() != null) {
            parameterRepository.deleteByStrategyId(strategyId);
            saveParameters(strategyId, request.parameters());
        }
        log.info("Updated strategy: id={}, user={}", savedStrategy.getId(), userId);
        return convertToDtoWithParameters(savedStrategy);
    }
    @Override
    @Transactional
    public void deleteStrategy(Long userId, Long strategyId) {
        log.debug("Deleting strategy: user={}, strategyId={}", userId, strategyId);
        // Delete parameters
        parameterRepository.deleteByStrategyId(strategyId);
        // Delete versions (cascade or manual)
        List<StrategyVersion> versions = versionRepository.findByStrategyIdOrderByVersionNumberDesc(strategyId);
        versionRepository.deleteAll(Objects.requireNonNull(versions, "versions must not be null"));
        // Delete strategy
        strategyRepository.deleteByIdAndUserId(strategyId, userId);
        log.info("Deleted strategy: user={}, strategyId={}", userId, strategyId);
    }
    @Override
    @Transactional
    public StrategyDto publishStrategy(Long userId, Long strategyId) {
        log.debug("Publishing strategy: user={}, strategyId={}", userId, strategyId);
        Strategy strategy = strategyAccessSupport.loadStrategyOrThrow(userId, strategyId);
        strategy.setStatus(Strategy.StrategyStatus.PUBLISHED);
        Strategy saved = strategyRepository.save(strategy);
        log.info("Published strategy: id={}, user={}", saved.getId(), userId);
        return convertToDtoWithParameters(saved);
    }
    @Override
    @Transactional
    public StrategyDto disableStrategy(Long userId, Long strategyId) {
        log.debug("Disabling strategy: user={}, strategyId={}", userId, strategyId);
        Strategy strategy = strategyAccessSupport.loadStrategyOrThrow(userId, strategyId);
        strategy.setStatus(Strategy.StrategyStatus.DISABLED);
        Strategy saved = strategyRepository.save(strategy);
        log.info("Disabled strategy: id={}, user={}", saved.getId(), userId);
        return convertToDtoWithParameters(saved);
    }
    @Override
    public List<StrategyVersionDto> getVersions(Long userId, Long strategyId) {
        log.debug("Getting versions: user={}, strategyId={}", userId, strategyId);
        verifyStrategyOwnershipOrThrow(userId, strategyId);
        List<StrategyVersion> versions = versionRepository.findByStrategyIdOrderByVersionNumberDesc(strategyId);
        return versions.stream()
            .map(this::convertVersionToDto)
            .toList();
    }
    @Override
    public StrategyVersionDto getVersion(Long userId, Long strategyId, Integer versionNumber) {
        log.debug("Getting version: user={}, strategyId={}, version={}", userId, strategyId, versionNumber);
        verifyStrategyOwnershipOrThrow(userId, strategyId);
        StrategyVersion version = loadVersionByNumberOrThrow(strategyId, versionNumber);
        return convertVersionToDto(version);
    }
    @Override
    @Transactional
    public StrategyVersionDto activateVersion(Long userId, Long strategyId, Long versionId) {
        log.debug("Activating version: user={}, strategyId={}, versionId={}", userId, strategyId, versionId);
        verifyStrategyOwnershipOrThrow(userId, strategyId);
        // Deactivate all versions
        versionRepository.deactivateAllVersions(strategyId);
        // Activate specified version
        versionRepository.activateVersion(versionId);
        StrategyVersion version = loadVersionByIdOrThrow(versionId);
        log.info("Activated version: strategyId={}, versionId={}", strategyId, versionId);
        return convertVersionToDto(version);
    }
    /**
     * Create a new version.
     */
    private void createNewVersion(Long strategyId, String code, String changelog) {
        StrategyVersion latestVersion = versionRepository
            .findFirstByStrategyIdOrderByVersionNumberDesc(strategyId)
            .orElse(null);
        int newVersionNumber = latestVersion != null ? latestVersion.getVersionNumber() + 1 : 1;
        // Deactivate current version
        versionRepository.deactivateAllVersions(strategyId);
        // Create new version
        StrategyVersion newVersion = StrategyVersion.builder()
            .strategyId(strategyId)
            .versionNumber(newVersionNumber)
            .code(code)
            .changelog(changelog != null ? changelog : "Updated")
            .isActive(true)
            .build();
        versionRepository.save(Objects.requireNonNull(newVersion, "newVersion must not be null"));
        // Update strategy version number
        strategyRepository.incrementVersion(strategyId);
    }
    /**
     * Save parameters for a strategy.
     */
    private void saveParameters(Long strategyId, List<StrategyParameterRequest> parameters) {
        List<StrategyParameter> entities = new ArrayList<>(parameters.size());
        for (int i = 0; i < parameters.size(); i++) {
            StrategyParameterRequest param = parameters.get(i);
            StrategyParameter entity = StrategyParameter.builder()
                .strategyId(strategyId)
                .paramName(param.paramName())
                .paramType(StrategyParameter.ParameterType.valueOf(param.paramType()))
                .defaultValue(param.defaultValue())
                .minValue(param.minValue())
                .maxValue(param.maxValue())
                .description(param.description())
                .isRequired(!Boolean.FALSE.equals(param.isRequired()))
                .sortOrder(param.sortOrder() != null ? param.sortOrder() : i)
                .build();
            entities.add(entity);
        }
        parameterRepository.saveAll(entities);
    }
    private StrategyVersion loadVersionByIdOrThrow(Long versionId) {
        return requireFound(versionRepository.findById(Objects.requireNonNull(versionId, "versionId must not be null")),
                () -> new ResourceNotFoundException("strategy version", versionId));
    }
    private StrategyVersion loadVersionByNumberOrThrow(Long strategyId, Integer versionNumber) {
        return requireFound(versionRepository.findByStrategyIdAndVersionNumber(strategyId, versionNumber),
                () -> new ResourceNotFoundException(
                        "Strategy version not found: strategyId=" + strategyId + ", version=" + versionNumber));
    }
    private void verifyStrategyOwnershipOrThrow(Long userId, Long strategyId) {
        if (!strategyRepository.existsByIdAndUserId(strategyId, userId)) {
            throw new BusinessException(ErrorCode.STRATEGY_NOT_FOUND, "Strategy not found");
        }
    }
    /**
     * Convert Strategy to DTO with parameters.
     */
    private StrategyDto convertToDtoWithParameters(Strategy strategy) {
        List<StrategyParameter> parameters = parameterRepository
            .findByStrategyIdOrderBySortOrderAsc(strategy.getId());
        List<StrategyParameterDto> paramDtos = parameters.stream()
            .map(strategyMapper::toStrategyParameterDto)
            .toList();
        return strategyMapper.toStrategyDto(strategy, paramDtos);
    }
    /**
     * Convert StrategyVersion to DTO.
     */
    private StrategyVersionDto convertVersionToDto(StrategyVersion version) {
        return strategyMapper.toStrategyVersionDto(version);
    }
}
