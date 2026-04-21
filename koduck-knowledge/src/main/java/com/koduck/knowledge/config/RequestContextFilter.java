package com.koduck.knowledge.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import org.apache.logging.log4j.ThreadContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component("knowledgeRequestContextFilter")
public class RequestContextFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestContextFilter.class);

    @Override
    protected void doFilterInternal(
            final HttpServletRequest request,
            final HttpServletResponse response,
            final FilterChain filterChain) throws ServletException, IOException {
        final long startedAtNanos = System.nanoTime();
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
        log.info(
                "knowledge http request received method={} path={} query={} remote_addr={}",
                request.getMethod(),
                request.getRequestURI(),
                summarizeQuery(request),
                safeValue(request.getRemoteAddr()));
        try {
            filterChain.doFilter(request, response);
        } finally {
            final long durationMs = (System.nanoTime() - startedAtNanos) / 1_000_000;
            log.info(
                    "knowledge http request completed method={} path={} status={} duration_ms={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs);
            ThreadContext.clearAll();
        }
    }

    private String summarizeQuery(final HttpServletRequest request) {
        return safeValue(request.getQueryString());
    }

    private String safeValue(final String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        if (value.length() <= 256) {
            return value;
        }
        return value.substring(0, 253) + "...";
    }
}
