package com.koduck.slice.controller;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller 切片测试示例（与业务接口解耦）
 */
@WebMvcTest(controllers = ExampleUserControllerTest.ExampleController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Controller 切片测试示例")
@Disabled("示例测试，默认不纳入 CI 执行")
class ExampleUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /test/users/ping 返回 200 与 pong")
    void ping_shouldReturnPong() throws Exception {
        mockMvc.perform(get("/test/users/ping"))
            .andExpect(status().isOk())
            .andExpect(content().string("pong"));
    }

    @RestController
    @RequestMapping("/test/users")
    static class ExampleController {

        @GetMapping("/ping")
        String ping() {
            return "pong";
        }
    }
}
