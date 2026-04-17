package com.koduck.knowledge.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.koduck.knowledge")
@EntityScan(basePackages = "com.koduck.knowledge.entity")
@EnableJpaRepositories(basePackages = "com.koduck.knowledge.repository")
public class KoduckKnowledgeApplication {

    public static void main(final String[] args) {
        SpringApplication.run(KoduckKnowledgeApplication.class, args);
    }
}
