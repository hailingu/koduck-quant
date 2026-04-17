package com.koduck.knowledge.it;

import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractKnowledgeIT {

    private static final Path DOCKER_DESKTOP_RAW_SOCKET = Path.of(
            System.getProperty("user.home"),
            "Library",
            "Containers",
            "com.docker.docker",
            "Data",
            "docker.raw.sock");

    static {
        // Docker Desktop's user socket can return an empty /info payload to docker-java on this host.
        // When the raw engine socket is available, pin Testcontainers to it before container startup.
        if (System.getProperty("docker.host") == null && Files.exists(DOCKER_DESKTOP_RAW_SOCKET)) {
            System.setProperty("docker.host", "unix://" + DOCKER_DESKTOP_RAW_SOCKET);
            System.setProperty("dockerconfig.source", "autoIgnoringUserProperties");
            System.setProperty("api.version", "1.41");
        }
    }

    protected static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("koduck_knowledge")
            .withUsername("koduck")
            .withPassword("koduck");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void registerDataSource(final DynamicPropertyRegistry registry) {
        registry.add("koduck.knowledge.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("koduck.knowledge.datasource.username", POSTGRES::getUsername);
        registry.add("koduck.knowledge.datasource.password", POSTGRES::getPassword);
    }
}
