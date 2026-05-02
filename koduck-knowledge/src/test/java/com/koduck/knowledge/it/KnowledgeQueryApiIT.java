package com.koduck.knowledge.it;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.koduck.knowledge.app.KoduckKnowledgeApplication;
import com.koduck.knowledge.it.support.PostgresFixture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = KoduckKnowledgeApplication.class)
@AutoConfigureMockMvc
class KnowledgeQueryApiIT extends AbstractKnowledgeIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedData() {
        PostgresFixture.resetAndSeed(jdbcTemplate);
    }

    @Test
    void shouldSearchByNameAndDomain() throws Exception {
        mockMvc.perform(get("/api/v1/entities/actions/search")
                        .param("name", "Alice")
                        .param("domainClass", "finance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[0].canonicalName").value("Alice"))
                .andExpect(jsonPath("$[0].matchType").value("CANONICAL_EXACT"))
                .andExpect(jsonPath("$[1].matchType").value("CANONICAL_EXACT"))
                .andExpect(jsonPath("$[2].matchType").value("ALIAS_EXACT"))
                .andExpect(jsonPath("$[3].matchType").value("ALIAS_EXACT"));
    }

    @Test
    void shouldReturnFactsWithBasicAndRequestedDetails() throws Exception {
        mockMvc.perform(post("/api/v1/entities/actions/facts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "entityIds": [100],
                                  "domainClass": "finance",
                                  "at": "2024-06-01T00:00:00Z",
                                  "profileEntryCodes": ["BIO", "HONOR"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].basicProfileS3Uri").exists())
                .andExpect(jsonPath("$[1].profileEntryCode").value("BIO"))
                .andExpect(jsonPath("$[1].blobUri").value("s3://knowledge/profile/100/BIO/1.json"))
                .andExpect(jsonPath("$[2].profileEntryCode").value("HONOR"));
    }

    @Test
    void shouldReturnBasicProfileAndHistories() throws Exception {
        mockMvc.perform(get("/api/v1/entities/100/basic-profile")
                        .param("domainClass", "finance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canonicalName").value("Alice"))
                .andExpect(jsonPath("$.entityName").value("Alice Zhang"));

        mockMvc.perform(get("/api/v1/entities/101/basic-profile/history")
                        .param("domainClass", "finance")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.total").value(2));

        mockMvc.perform(get("/api/v1/entities/100/profiles/BIO/history")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].version").value(2))
                .andExpect(jsonPath("$.items[0].validFrom").value("2025-01-01T00:00:00Z"));
    }

    @Test
    void shouldReturnTemporalProfileHistoryByWindow() throws Exception {
        mockMvc.perform(get("/api/v1/entities/100/profiles/BIO/history")
                        .param("from", "2024-06-01T00:00:00Z")
                        .param("to", "2024-12-31T23:59:59Z")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].version").value(1))
                .andExpect(jsonPath("$.items[0].validTo").value("2025-01-01T00:00:00Z"));

        mockMvc.perform(get("/api/v1/entities/100/profiles/BIO/history")
                        .param("from", "2025-01-01T00:00:00Z")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].version").value(2));
    }

    @Test
    void shouldReturnTemporalProfileDetailByAt() throws Exception {
        mockMvc.perform(get("/api/v1/entities/100/profiles/BIO")
                        .param("at", "2024-06-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.blobUri").value("s3://knowledge/profile/100/BIO/1.json"))
                .andExpect(jsonPath("$.validFrom").value("2024-01-01T00:00:00Z"))
                .andExpect(jsonPath("$.validTo").value("2025-01-01T00:00:00Z"));

        mockMvc.perform(get("/api/v1/entities/100/profiles/BIO")
                        .param("at", "2025-06-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.blobUri").value("s3://knowledge/profile/100/BIO/2.json"))
                .andExpect(jsonPath("$.validFrom").value("2025-01-01T00:00:00Z"));
    }

    @Test
    void shouldReturnTemporalCoverageGroupedByBlob() throws Exception {
        mockMvc.perform(get("/api/v1/entities/100/temporal-coverage")
                        .param("from", "2024-06-15T00:00:00Z")
                        .param("to", "2024-09-15T00:00:00Z")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[0].entryCode").value("BIO"))
                .andExpect(jsonPath("$.items[0].matchedSpans.length()").value(1))
                .andExpect(jsonPath("$.items[1].entryCode").value("HONOR"))
                .andExpect(jsonPath("$.items[1].matchedSpans.length()").value(2));
    }
}
