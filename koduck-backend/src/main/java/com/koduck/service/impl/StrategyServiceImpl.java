package com.koduck.service.impl;

import com.koduck.dto.strategy.*;
import com.koduck.entity.Strategy;
import com.koduck.entity.StrategyParameter;
import com.koduck.entity.StrategyVersion;
import com.koduck.repository.StrategyParameterRepository;
import com.koduck.repository.StrategyRepository;
import com.koduck.repository.StrategyVersionRepository;
import com.koduck.service.StrategyService;
import com.koduck.service.support.StrategyAccessSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Implementation of StrategyService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StrategyServiceImpl implements StrategyService {

    private final StrategyRepository strategyRepository;
    private final StrategyVersionRepository versionRepository;
    private final StrategyParameterRepository parameterRepository;
    private final StrategyAccessSupport strategyAccessSupport;

    private static final String DEFAULT_CODE_TEMPLATE = """
#
# Python

def initialize(context):
    # Set the default symbol and market.
    context.symbol = "000001"
    context.market = "AShare"

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
""";
    
    @Override
    public List<StrategyDto> getStrategies(Long userId) {
        log.debug("Getting strategies for user: {}", userId);
        
        List<Strategy> strategies = strategyRepository.findByUserId(userId);
        
        return strategies.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
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
        
        Strategy savedStrategy = strategyRepository.save(strategy);
        
        // Create initial version
        StrategyVersion version = StrategyVersion.builder()
            .strategyId(savedStrategy.getId())
            .versionNumber(1)
            .code(request.code() != null ? request.code() : DEFAULT_CODE_TEMPLATE)
            .changelog("Initial version")
            .isActive(true)
            .build();
        
        versionRepository.save(version);
        
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
        
        Strategy savedStrategy = strategyRepository.save(strategy);
        
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
        versionRepository.deleteAll(versions);
        
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
            .collect(Collectors.toList());
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
        
        versionRepository.save(newVersion);
        
        // Update strategy version number
        strategyRepository.incrementVersion(strategyId);
    }
    
    /**
     * Save parameters for a strategy.
     */
    private void saveParameters(Long strategyId, List<StrategyParameterRequest> parameters) {
        List<StrategyParameter> entities = new ArrayList<>();
        
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
                .isRequired(param.isRequired() != null ? param.isRequired() : true)
                .sortOrder(param.sortOrder() != null ? param.sortOrder() : i)
                .build();
            
            entities.add(entity);
        }
        
        parameterRepository.saveAll(entities);
    }

    private StrategyVersion loadVersionByIdOrThrow(Long versionId) {
        return requireFound(versionRepository.findById(versionId),
                () -> new IllegalArgumentException("Version not found"));
    }

    private StrategyVersion loadVersionByNumberOrThrow(Long strategyId, Integer versionNumber) {
        return requireFound(versionRepository.findByStrategyIdAndVersionNumber(strategyId, versionNumber),
                () -> new IllegalArgumentException("Version not found"));
    }

    private void verifyStrategyOwnershipOrThrow(Long userId, Long strategyId) {
        if (!strategyRepository.existsByIdAndUserId(strategyId, userId)) {
            throw new IllegalArgumentException("Strategy not found");
        }
    }
    
    /**
     * Convert Strategy to DTO.
     */
    private StrategyDto convertToDto(Strategy strategy) {
        return StrategyDto.builder()
            .id(strategy.getId())
            .name(strategy.getName())
            .description(strategy.getDescription())
            .status(strategy.getStatus().name())
            .currentVersion(strategy.getCurrentVersion())
            .createdAt(strategy.getCreatedAt())
            .updatedAt(strategy.getUpdatedAt())
            .build();
    }
    
    /**
     * Convert Strategy to DTO with parameters.
     */
    private StrategyDto convertToDtoWithParameters(Strategy strategy) {
        List<StrategyParameter> parameters = parameterRepository
            .findByStrategyIdOrderBySortOrderAsc(strategy.getId());
        
        List<StrategyParameterDto> paramDtos = parameters.stream()
            .map(this::convertParameterToDto)
            .collect(Collectors.toList());
        
        return StrategyDto.builder()
            .id(strategy.getId())
            .name(strategy.getName())
            .description(strategy.getDescription())
            .status(strategy.getStatus().name())
            .currentVersion(strategy.getCurrentVersion())
            .createdAt(strategy.getCreatedAt())
            .updatedAt(strategy.getUpdatedAt())
            .parameters(paramDtos)
            .build();
    }
    
    /**
     * Convert StrategyParameter to DTO.
     */
    private StrategyParameterDto convertParameterToDto(StrategyParameter param) {
        return StrategyParameterDto.builder()
            .id(param.getId())
            .paramName(param.getParamName())
            .paramType(param.getParamType().name())
            .defaultValue(param.getDefaultValue())
            .minValue(param.getMinValue())
            .maxValue(param.getMaxValue())
            .description(param.getDescription())
            .isRequired(param.getIsRequired())
            .sortOrder(param.getSortOrder())
            .build();
    }
    
    /**
     * Convert StrategyVersion to DTO.
     */
    private StrategyVersionDto convertVersionToDto(StrategyVersion version) {
        return StrategyVersionDto.builder()
            .id(version.getId())
            .versionNumber(version.getVersionNumber())
            .code(version.getCode())
            .changelog(version.getChangelog())
            .isActive(version.getIsActive())
            .createdAt(version.getCreatedAt())
            .build();
    }
}
