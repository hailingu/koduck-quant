package com.koduck.knowledge.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class InternalToolCatalogControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new InternalToolCatalogController()).build();
    }

    @Test
    void shouldExposeKnowledgeToolCatalog() throws Exception {
        mockMvc.perform(get("/internal/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("koduck-knowledge"))
                .andExpect(jsonPath("$.tools[0].name").value("query_knowledge"))
                .andExpect(jsonPath("$.tools[0].permissionScope").value("knowledge.read"));
    }
}
