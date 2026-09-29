package com.example.backend.audit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

/**
 * Receives audit events the backend cannot observe as a request mutation —
 * primarily client-side XLSX exports generated in the browser. Writes one
 * {@code AUDIT} line (marked {@code source=client}) and returns 204.
 */
@Slf4j
@RestController
@RequestMapping("/api/audit")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class AuditController {

    private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");

    @PostMapping("/event")
    public ResponseEntity<Void> recordEvent(@RequestBody AuditEventRequest event, HttpServletRequest request) {
        try {
            AuditContext ctx = AuditContext.from(request);
            AUDIT.info("ts={} actor={} role=\"{}\" ip={} action=\"{}\" target=\"{}\" targetType={} count={} detail=\"{}\" source=client",
                    OffsetDateTime.now(),
                    ctx.actor(), ctx.role(), ctx.ip(),
                    clean(event.action(), "unspecified"),
                    clean(event.target(), "-"),
                    clean(event.targetType(), "-"),
                    event.count() != null ? event.count() : "-",
                    clean(event.detail(), "-"));
        } catch (Exception e) {
            log.warn("Failed to record client audit event: {}", e.toString());
        }
        return ResponseEntity.noContent().build();
    }

    private static String clean(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim().replace("\"", "'").replace("\n", " ").replace("\r", " ");
    }
}
