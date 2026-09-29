package com.example.backend.audit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Emits one {@code AUDIT} line per state-changing request (POST/PUT/PATCH/DELETE)
 * plus a small allowlist of report-export GETs. Purely observational — it never
 * alters the request/response and never throws.
 *
 * <p>The acting user comes from the {@code X-Actor-Login} / {@code X-Actor-Role}
 * headers the frontend attaches; the backend itself talks to Documentum as the
 * service account, so this interceptor is the only place the human identity is
 * recorded.
 */
@Slf4j
@Component
public class AuditLogInterceptor implements HandlerInterceptor {

    /** Dedicated logger — routed to {@code app.log} by {@code logback-spring.xml}. */
    private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");

    private static final String START_NANOS = AuditLogInterceptor.class.getName() + ".start";

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    /** Diagnostic / polling endpoints that are noise in an audit trail. */
    private static final Set<String> SKIP_URIS = Set.of(
            "/api/users/otds/probe",
            "/api/auth/config",
            "/api/auth/current-user"
    );

    /** Request params worth surfacing as the action target when present. */
    private static final List<String> TARGET_PARAMS = List.of(
            "objectId", "loginName", "userLoginName", "username", "userName",
            "group", "groupName", "memberName", "shortCode", "id",
            "processId", "workflowId", "caseId", "verticalGroupName"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_NANOS, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        try {
            if (!shouldAudit(request, handler)) {
                return;
            }

            AuditContext ctx = AuditContext.from(request);
            String handlerKey = handlerKey(handler);
            String action = resolveAction(request, handlerKey);
            String target = resolveTarget(request);
            long ms = elapsedMillis(request);

            AUDIT.info("ts={} actor={} role=\"{}\" ip={} action=\"{}\" target=\"{}\" method={} uri={} status={} ms={} source=request",
                    OffsetDateTime.now(),
                    ctx.actor(), ctx.role(), ctx.ip(),
                    action, target,
                    request.getMethod(), request.getRequestURI(),
                    response.getStatus(), ms);
        } catch (Exception loggingFailure) {
            log.warn("Audit logging failed for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), loggingFailure.toString());
        }
    }

    private boolean shouldAudit(HttpServletRequest request, Object handler) {
        String method = request.getMethod();
        if ("OPTIONS".equalsIgnoreCase(method)) {
            return false;
        }
        String uri = request.getRequestURI();
        if (uri == null) {
            return false;
        }
        // Strip the WAR context path (/neoadminBackend) so matching is stable
        // across the dev proxy and the deployed WAR.
        String path = uri;
        String ctxPath = request.getContextPath();
        if (ctxPath != null && !ctxPath.isEmpty() && path.startsWith(ctxPath)) {
            path = path.substring(ctxPath.length());
        }
        if (path.startsWith("/api/audit")) {
            return false; // AuditController logs its own events
        }
        if (SKIP_URIS.contains(path)) {
            return false;
        }
        if (WRITE_METHODS.contains(method.toUpperCase())) {
            return true;
        }
        // GET: only the report-export allowlist.
        return "GET".equalsIgnoreCase(method)
                && AuditActions.AUDITED_GETS.contains(handlerKey(handler));
    }

    private String handlerKey(Object handler) {
        if (handler instanceof HandlerMethod hm) {
            return hm.getBeanType().getSimpleName() + "#" + hm.getMethod().getName();
        }
        return "";
    }

    private String resolveAction(HttpServletRequest request, String handlerKey) {
        String label = AuditActions.LABELS.get(handlerKey);
        if (label != null) {
            return label;
        }
        // Fallback: "<VERB> <last non-templated path segment>".
        String uri = request.getRequestURI();
        String lastSegment = "";
        if (uri != null) {
            String[] parts = uri.split("/");
            for (int i = parts.length - 1; i >= 0; i--) {
                if (!parts[i].isBlank()) {
                    lastSegment = parts[i];
                    break;
                }
            }
        }
        return (request.getMethod() + " " + lastSegment).trim();
    }

    @SuppressWarnings("unchecked")
    private String resolveTarget(HttpServletRequest request) {
        StringBuilder target = new StringBuilder();

        Object pathVars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (pathVars instanceof Map<?, ?> map && !map.isEmpty()) {
            target.append(((Map<String, String>) map).entrySet().stream()
                    .map(e -> e.getKey() + "=" + e.getValue())
                    .collect(Collectors.joining(", ")));
        }

        String params = TARGET_PARAMS.stream()
                .filter(p -> request.getParameter(p) != null && !request.getParameter(p).isBlank())
                .map(p -> p + "=" + request.getParameter(p))
                .collect(Collectors.joining(", "));
        if (!params.isEmpty()) {
            if (target.length() > 0) target.append("; ");
            target.append(params);
        }

        String result = target.toString().replace("\"", "'").replace("\n", " ").replace("\r", " ");
        return result.isEmpty() ? "-" : result;
    }

    private long elapsedMillis(HttpServletRequest request) {
        Object start = request.getAttribute(START_NANOS);
        if (start instanceof Long startNanos) {
            return (System.nanoTime() - startNanos) / 1_000_000L;
        }
        return -1L;
    }
}
