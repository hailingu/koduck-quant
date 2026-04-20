package com.koduck.knowledge.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.koduck.knowledge.entity.DomainDictEntity;
import com.koduck.knowledge.repository.DomainDictRepository;
import com.koduck.knowledge.service.DomainCatalogService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class InternalDomainCatalogControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new InternalDomainCatalogController(new DomainCatalogService(stubDomainDictRepository())))
                .build();
    }

    @Test
    void shouldExposeDomainClassesFromDictionary() throws Exception {
        mockMvc.perform(get("/internal/domain-classes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("koduck-knowledge"))
                .andExpect(jsonPath("$.domainClasses[0]").value("history"))
                .andExpect(jsonPath("$.domainClasses[1]").value("military"))
                .andExpect(jsonPath("$.domainClasses[2]").value("politics"));
    }

    private DomainDictRepository stubDomainDictRepository() {
        return new DomainDictRepository() {
            @Override
            public List<DomainDictEntity> findAllByOrderByDomainClassAsc() {
                return List.of(domain("history"), domain("military"), domain("politics"));
            }

            @Override
            public java.util.Optional<DomainDictEntity> findByDomainClass(final String domainClass) {
                return findAllByOrderByDomainClassAsc().stream()
                        .filter(domain -> domain.getDomainClass().equals(domainClass))
                        .findFirst();
            }
        };
    }

    private DomainDictEntity domain(final String domainClass) {
        final DomainDictEntity entity = new DomainDictEntity();
        entity.setDomainClass(domainClass);
        return entity;
    }
}
