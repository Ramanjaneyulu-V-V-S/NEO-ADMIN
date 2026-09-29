package com.example.backend.controller;

import com.example.backend.audit.AuditContext;
import com.example.backend.service.QueryService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/query")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class QueryController {

    /** Same dedicated logger {@code AuditLogInterceptor} writes to. */
    private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");

    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    /**
     * Execute a single read-only DQL query with an optional row limit.
     *
     * <p>{@link com.example.backend.audit.AuditLogInterceptor} already records the
     * request envelope but cannot see the JSON body, so the DQL text itself is
     * audited here.
     */
    @PostMapping("/execute")
    public Map<String, Object> executeQuery(@RequestBody Map<String, Object> request, HttpServletRequest httpRequest) {
        String dql = (String) request.get("dql");
        Integer limit = request.get("limit") != null ? ((Number) request.get("limit")).intValue() : 10000;

        auditDql(httpRequest, dql, limit);

        return queryService.executeQuery(dql, limit);
    }

    private void auditDql(HttpServletRequest httpRequest, String dql, Integer limit) {
        try {
            AuditContext ctx = AuditContext.from(httpRequest);
            String text = dql == null ? "" : dql.replaceAll("\\s+", " ").trim();
            String verb = text.isEmpty() ? "-" : text.split("\\s", 2)[0].toUpperCase();
            if (text.length() > 1000) {
                text = text.substring(0, 1000) + "…";
            }
            AUDIT.info("ts={} actor={} role=\"{}\" ip={} action=\"Execute DQL query\" verb={} limit={} dql=\"{}\" source=query-tab",
                    OffsetDateTime.now(), ctx.actor(), ctx.role(), ctx.ip(), verb, limit, text.replace("\"", "'"));
        } catch (Exception loggingFailure) {
            AUDIT.warn("Failed to audit DQL query: {}", loggingFailure.toString());
        }
    }
}
