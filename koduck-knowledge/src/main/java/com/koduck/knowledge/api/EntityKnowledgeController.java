package com.koduck.knowledge.api;

import com.koduck.knowledge.dto.BasicProfileSegment;
import com.koduck.knowledge.dto.BasicProfileView;
import com.koduck.knowledge.dto.EntityFactView;
import com.koduck.knowledge.dto.FactsRequest;
import com.koduck.knowledge.dto.PageView;
import com.koduck.knowledge.dto.ProfileDetailView;
import com.koduck.knowledge.dto.ProfileVersionView;
import com.koduck.knowledge.dto.SearchHit;
import com.koduck.knowledge.service.EntityKnowledgeQueryService;
import com.koduck.knowledge.service.EntitySearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/entities")
public class EntityKnowledgeController {

    private final EntitySearchService entitySearchService;
    private final EntityKnowledgeQueryService entityKnowledgeQueryService;

    public EntityKnowledgeController(
            final EntitySearchService entitySearchService,
            final EntityKnowledgeQueryService entityKnowledgeQueryService) {
        this.entitySearchService = entitySearchService;
        this.entityKnowledgeQueryService = entityKnowledgeQueryService;
    }

    @Operation(summary = "Search entity knowledge hits")
    @GetMapping("/actions/search")
    public List<SearchHit> search(
            @Parameter(required = true) @RequestParam("name") final String name,
            @Parameter(required = true) @RequestParam("domainClass") final String domainClass,
            @RequestParam(value = "at", required = false) final OffsetDateTime at) {
        return entitySearchService.search(name, domainClass, at);
    }

    @Operation(summary = "Fetch read-only facts")
    @PostMapping("/actions/facts")
    public List<EntityFactView> facts(@Valid @RequestBody final FactsRequest request) {
        return entityKnowledgeQueryService.facts(request);
    }

    @Operation(summary = "Get basic profile")
    @GetMapping("/{id}/basic-profile")
    public BasicProfileView getBasicProfile(
            @PathVariable("id") final long id,
            @RequestParam("domainClass") final String domainClass,
            @RequestParam(value = "at", required = false) final OffsetDateTime at) {
        return entityKnowledgeQueryService.getBasicProfile(id, domainClass, at);
    }

    @Operation(summary = "Get current non-basic profile")
    @GetMapping("/{id}/profiles/{entry_code}")
    public ProfileDetailView getProfileDetail(
            @PathVariable("id") final long id,
            @PathVariable("entry_code") final String entryCode) {
        return entityKnowledgeQueryService.getProfileDetail(id, entryCode);
    }

    @Operation(summary = "Get basic profile history")
    @GetMapping("/{id}/basic-profile/history")
    public PageView<BasicProfileSegment> getBasicProfileHistory(
            @PathVariable("id") final long id,
            @RequestParam("domainClass") final String domainClass,
            @RequestParam(value = "page", defaultValue = "1") final int page,
            @RequestParam(value = "size", defaultValue = "20") final int size) {
        return entityKnowledgeQueryService.getBasicProfileHistory(id, domainClass, page, size);
    }

    @Operation(summary = "Get profile history")
    @GetMapping("/{id}/profiles/{entry_code}/history")
    public PageView<ProfileVersionView> getProfileHistory(
            @PathVariable("id") final long id,
            @PathVariable("entry_code") final String entryCode,
            @RequestParam(value = "page", defaultValue = "1") final int page,
            @RequestParam(value = "size", defaultValue = "20") final int size) {
        return entityKnowledgeQueryService.getProfileHistory(id, entryCode, page, size);
    }
}
