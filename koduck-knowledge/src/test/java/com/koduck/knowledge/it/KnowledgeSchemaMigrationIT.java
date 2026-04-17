package com.koduck.knowledge.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.koduck.knowledge.app.KoduckKnowledgeApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(classes = KoduckKnowledgeApplication.class)
class KnowledgeSchemaMigrationIT extends AbstractKnowledgeIT {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldApplySchemaAndSeeds() {
        final Integer domainCount = jdbcTemplate.queryForObject(
                "select count(*) from domain_dict where domain_class = 'finance'",
                Integer.class);
        final Integer profileCount = jdbcTemplate.queryForObject(
                "select count(*) from profile_entry_dict where code in ('BASIC','BIO','HONOR')",
                Integer.class);

        assertThat(domainCount).isEqualTo(1);
        assertThat(profileCount).isEqualTo(3);
    }
}
