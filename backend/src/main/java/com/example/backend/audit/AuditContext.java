package com.example.backend.audit;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The "who / from where" of a single request, resolved from the {@code X-Actor-*}
 * headers the frontend attaches (see {@code frontend/src/api/axios.js}) and the
 * usual proxy forwarding headers. Shared by {@link AuditLogInterceptor} and
 * {@link AuditController} so both emit identical actor fields.
 */
public record AuditContext(String actor, String role, String ip) {

    public static AuditContext from(HttpServletRequest request) {
        String actor = trimToNull(request.getHeader("X-Actor-Login"));
        String role  = trimToNull(request.getHeader("X-Actor-Role"));
        return new AuditContext(
                actor != null ? actor : "anonymous",
                role  != null ? role  : "-",
                clientIp(request));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // First hop is the original client.
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
