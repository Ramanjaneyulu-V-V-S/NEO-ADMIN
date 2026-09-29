package com.example.backend.audit;

/**
 * Payload for {@code POST /api/audit/event} — used by the frontend to record
 * actions the backend never sees as a mutation, chiefly client-built XLSX
 * exports (User Directory, Reports, Metadata) generated in-browser via exceljs.
 *
 * @param action     human-readable action label, e.g. "Export User Directory"
 * @param target     what was acted on (report name, filter summary, …); optional
 * @param targetType coarse category, e.g. "report" / "user" / "group"; optional
 * @param detail     free-text extra context; optional
 * @param count      row/record count where meaningful; optional
 */
public record AuditEventRequest(
        String action,
        String target,
        String targetType,
        String detail,
        Integer count
) {}
