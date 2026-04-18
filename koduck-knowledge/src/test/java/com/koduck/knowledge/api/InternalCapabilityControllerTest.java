package com.koduck.knowledge.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.koduck.knowledge.config.RequestContextFilter;
import com.koduck.knowledge.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class InternalCapabilityControllerTest {

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new InternalCapabilityController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .addFilters(new RequestContextFilter())
            .build();

    @Test
    @DisplayName("should expose knowledge capabilities for registry discovery")
    void shouldExposeKnowledgeCapabilities() throws Exception {
        mockMvc.perform(get("/internal/capabilities"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.service").value("koduck-knowledge"))
                .andExpect(jsonPath("$.serviceKind").value("knowledge"))
                .andExpect(jsonPath("$.contractVersions[0]").value("v1"))
                .andExpect(jsonPath("$.features[0]").value("entity_search"))
                .andExpect(jsonPath("$.limits.transport").value("http"));
    }
}
