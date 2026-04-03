package com.koduck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Koduck backend application entry point.
 *
 * @author Koduck Team
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableAsync
public final class KoduckApplication {

    private KoduckApplication() {
        // utility class
    }

    /**
     * Starts the Spring Boot application.
     *
     * @param args startup arguments
     */
    public static void main(final String[] args) {
        SpringApplication.run(KoduckApplication.class, args);
    }
}
