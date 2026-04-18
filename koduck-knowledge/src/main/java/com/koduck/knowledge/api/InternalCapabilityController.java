package com.koduck.knowledge.api;

import com.koduck.knowledge.dto.KnowledgeCapabilityView;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalCapabilityController {

    @GetMapping("/capabilities")
    public KnowledgeCapabilityView getCapabilities() {
        return new KnowledgeCapabilityView(
                "koduck-knowledge",
                "knowledge",
                List.of("v1"),
                List.of(
                        "entity_search",
                        "entity_facts",
                        "basic_profile",
                        "profile_history"),
                Map.of(
                        "recommended_timeout_ms", "5000",
                        "transport", "http",
                        "auth_mode", "apisix-header-forward"));
    }
}
