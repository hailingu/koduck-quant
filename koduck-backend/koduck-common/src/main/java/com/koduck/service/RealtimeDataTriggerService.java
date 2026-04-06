package com.koduck.service;

import java.util.List;

/**
 * Service interface for triggering realtime data updates.
 * <p>
 * This interface is defined in koduck-common to allow cross-module
 * communication without direct dependency on koduck-market.
 * Implementations should be provided by koduck-market module.
 *
 * @author Koduck Team
 */
public interface RealtimeDataTriggerService {

    /**
     * Trigger realtime data update for given symbols.
     *
     * @param symbols the list of symbols to refresh
     */
    void triggerRealtimeUpdate(List<String> symbols);
}
