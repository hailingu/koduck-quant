package com.koduck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Koduck Quant 后端服务启动类。
 *
 * @author Koduck Team
 */
@SpringBootApplication
@EnableAsync
public class KoduckApplication {

    public static void main(String[] args) {
        SpringApplication.run(KoduckApplication.class, args);
    }
}
