package com.koduck.knowledge.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component("knowledgeRequestContextFilter")
public class RequestContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            final HttpServletRequest request,
            final HttpServletResponse response,
            final FilterChain filterChain) throws ServletException, IOException {
        final String requestId = Optional.ofNullable(request.getHeader("X-Request-Id"))
                .filter(value -> !value.isBlank())
                .orElseGet(() -> UUID.randomUUID().toString());
        ThreadContext.put("request_id", requestId);
        ThreadContext.put("trace_id", Optional.ofNullable(request.getHeader("X-B3-TraceId")).orElse(""));
        ThreadContext.put("span_id", Optional.ofNullable(request.getHeader("X-B3-SpanId")).orElse(""));
        ThreadContext.put("entity_id", "");
        ThreadContext.put("domain_class", "");
        ThreadContext.put("profile_entry_id", "");
        response.setHeader("X-Request-Id", requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            ThreadContext.clearAll();
        }
    }
}
