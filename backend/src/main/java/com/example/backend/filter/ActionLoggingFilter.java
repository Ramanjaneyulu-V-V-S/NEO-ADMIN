package com.example.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Slf4j(topic = "APP_LOGGER")
public class ActionLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String username = request.getHeader("X-User-Name");
        if (username == null || username.isBlank()) {
            username = "System/Anonymous";
        }

        String method = request.getMethod();
        String uri = request.getRequestURI();
        
        // Skip logging for auth preflight/login to avoid spamming the logs
        if (uri.startsWith("/api/auth/login") || "OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String query = request.getQueryString();
        String fullUri = uri + (query != null ? "?" + query : "");

        log.info("USER ACTION | User: {} | Method: {} | Path: {}", username, method, fullUri);

        filterChain.doFilter(request, response);
    }
}
