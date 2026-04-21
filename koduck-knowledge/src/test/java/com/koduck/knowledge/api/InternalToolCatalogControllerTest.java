package com.koduck.knowledge.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.koduck.knowledge.entity.DomainDictEntity;
import com.koduck.knowledge.entity.ProfileEntryDictEntity;
import com.koduck.knowledge.repository.DomainDictRepository;
import com.koduck.knowledge.repository.ProfileEntryDictRepository;
import com.koduck.knowledge.service.DomainCatalogService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class InternalToolCatalogControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new InternalToolCatalogController(
                        new DomainCatalogService(stubDomainDictRepository(), stubProfileEntryDictRepository())))
                .build();
    }

    @Test
    void shouldExposeKnowledgeToolCatalog() throws Exception {
        mockMvc.perform(get("/internal/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("koduck-knowledge"))
                .andExpect(jsonPath("$.tools[0].name").value("query_knowledge"))
                .andExpect(jsonPath("$.tools[0].permissionScope").value("knowledge.read"))
                .andExpect(jsonPath("$.tools[0].inputSchema", containsString("\"enum\":[\"history\",\"military\",\"politics\"]")))
                .andExpect(jsonPath("$.tools[0].inputSchema", containsString("domain_dict")))
                .andExpect(jsonPath("$.tools[1].name").value("get_knowledge_profile_detail"))
                .andExpect(jsonPath("$.tools[1].inputSchema", containsString("\"enum\":[\"BIO\",\"HONOR\"]")))
                .andExpect(jsonPath("$.tools[1].inputSchema", containsString("profile_entry_dict")));
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

    private ProfileEntryDictRepository stubProfileEntryDictRepository() {
        return new ProfileEntryDictRepository() {
            @Override
            public List<ProfileEntryDictEntity> findAllByIsBasicFalseOrderByCodeAsc() {
                return List.of(profileEntry("BIO"), profileEntry("HONOR"));
            }

            @Override
            public java.util.Optional<ProfileEntryDictEntity> findByCode(final String code) {
                return findAllByIsBasicFalseOrderByCodeAsc().stream()
                        .filter(entry -> entry.getCode().equals(code))
                        .findFirst();
            }
        };
    }

    private ProfileEntryDictEntity profileEntry(final String code) {
        final ProfileEntryDictEntity entity = new ProfileEntryDictEntity();
        entity.setCode(code);
        entity.setBasic(false);
        return entity;
    }
}
