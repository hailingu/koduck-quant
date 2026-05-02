package com.koduck.knowledge.it.support;

import org.springframework.jdbc.core.JdbcTemplate;

public final class PostgresFixture {

    private PostgresFixture() {
    }

    public static void resetAndSeed(final JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("delete from entity_profile_span");
        jdbcTemplate.execute("delete from entity_profile");
        jdbcTemplate.execute("delete from entity_basic_profile");
        jdbcTemplate.execute("delete from entity_alias");
        jdbcTemplate.execute("delete from entity");

        jdbcTemplate.update(
                "insert into entity(entity_id, canonical_name, type, created_at) values (?,?,?,now())",
                100L, "Alice", "person");
        jdbcTemplate.update(
                "insert into entity(entity_id, canonical_name, type, created_at) values (?,?,?,now())",
                101L, "Alice", "person");

        jdbcTemplate.update(
                "insert into entity_alias(alias_id, entity_id, alias, lang, source) values (?,?,?,?,?)",
                1L, 100L, "Alice", "en", "fixture");
        jdbcTemplate.update(
                "insert into entity_alias(alias_id, entity_id, alias, lang, source) values (?,?,?,?,?)",
                2L, 101L, "Alice", "en", "fixture");

        jdbcTemplate.update(
                """
                insert into entity_basic_profile(
                    entity_id, domain_class, entity_name, valid_from, valid_to, basic_profile_entry_id, basic_profile_s3_uri
                ) values (?,?,?,?,?,?,?)
                """,
                100L, "finance", "Alice Zhang", java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")),
                null, 1, "s3://knowledge/basic/100/BASIC/20250101T000000Z.json");
        jdbcTemplate.update(
                """
                insert into entity_basic_profile(
                    entity_id, domain_class, entity_name, valid_from, valid_to, basic_profile_entry_id, basic_profile_s3_uri
                ) values (?,?,?,?,?,?,?)
                """,
                101L, "finance", "Alice Li", java.sql.Timestamp.from(java.time.Instant.parse("2024-01-01T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")),
                1, "s3://knowledge/basic/101/BASIC/20240101T000000Z.json");
        jdbcTemplate.update(
                """
                insert into entity_basic_profile(
                    entity_id, domain_class, entity_name, valid_from, valid_to, basic_profile_entry_id, basic_profile_s3_uri
                ) values (?,?,?,?,?,?,?)
                """,
                101L, "finance", "Alice Li", java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")),
                null, 1, "s3://knowledge/basic/101/BASIC/20250101T000000Z.json");

        jdbcTemplate.update(
                """
                insert into entity_profile(
                    profile_id, entity_id, profile_entry_id, blob_uri, version, is_current, loaded_at, valid_from, valid_to
                ) values (?,?,?,?,?,?,?,?,?)
                """,
                1000L, 100L, 2, "s3://knowledge/profile/100/BIO/1.json", 1, false,
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-02T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2024-01-01T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")));
        jdbcTemplate.update(
                """
                insert into entity_profile(
                    profile_id, entity_id, profile_entry_id, blob_uri, version, is_current, loaded_at, valid_from, valid_to
                ) values (?,?,?,?,?,?,?,?,?)
                """,
                1001L, 100L, 2, "s3://knowledge/profile/100/BIO/2.json", 2, true,
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-03T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")),
                null);
        jdbcTemplate.update(
                """
                insert into entity_profile(
                    profile_id, entity_id, profile_entry_id, blob_uri, version, is_current, loaded_at, valid_from, valid_to
                ) values (?,?,?,?,?,?,?,?,?)
                """,
                1002L, 100L, 3, "s3://knowledge/profile/100/HONOR/1.json", 1, true,
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-04T00:00:00Z")),
                null,
                null);

        jdbcTemplate.update(
                """
                insert into entity_profile_span(
                    span_id, profile_id, entity_id, entry_code, blob_uri, span_from, span_to, summary, granularity, sort_order
                ) values (?,?,?,?,?,?,?,?,?,?)
                """,
                2000L, 1000L, 100L, "BIO", "s3://knowledge/profile/100/BIO/1.json",
                java.sql.Timestamp.from(java.time.Instant.parse("2024-01-01T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2025-01-01T00:00:00Z")),
                "Alice served as CFO during 2024", "YEAR", 1);
        jdbcTemplate.update(
                """
                insert into entity_profile_span(
                    span_id, profile_id, entity_id, entry_code, blob_uri, span_from, span_to, summary, granularity, sort_order
                ) values (?,?,?,?,?,?,?,?,?,?)
                """,
                2001L, 1002L, 100L, "HONOR", "s3://knowledge/profile/100/HONOR/1.json",
                java.sql.Timestamp.from(java.time.Instant.parse("2024-06-01T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2024-07-01T00:00:00Z")),
                "Received industry honor in June 2024", "MONTH", 1);
        jdbcTemplate.update(
                """
                insert into entity_profile_span(
                    span_id, profile_id, entity_id, entry_code, blob_uri, span_from, span_to, summary, granularity, sort_order
                ) values (?,?,?,?,?,?,?,?,?,?)
                """,
                2002L, 1002L, 100L, "HONOR", "s3://knowledge/profile/100/HONOR/1.json",
                java.sql.Timestamp.from(java.time.Instant.parse("2024-09-01T00:00:00Z")),
                java.sql.Timestamp.from(java.time.Instant.parse("2024-10-01T00:00:00Z")),
                "Received second industry honor in September 2024", "MONTH", 2);
    }
}
