package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class DigidakReportService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public DigidakReportService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        return "Basic " + Base64.getEncoder().encodeToString(
                (dctmConfig.getUsername() + ":" + dctmConfig.getPassword()).getBytes(StandardCharsets.UTF_8));
    }

    private String repoUrl() {
        return dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
    }

    // ─── Summary KPIs ────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> getSummary(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        Map<String, Object> summary = new LinkedHashMap<>();

        summary.put("total", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where));
        summary.put("unread", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where + and(where) + "status = 'Unread'"));
        summary.put("opened", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where + and(where) + "status = 'Opened'"));
        summary.put("assigned", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where + and(where) + "status IN ('Assigned','Assigned Head')"));
        summary.put("closed", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where + and(where) + "status = 'Closed'"));
        summary.put("inprocess", executeCount("SELECT COUNT(*) as cnt FROM cms_digidak_folder" + where + and(where) + "status = 'Inprocess'"));

        return summary;
    }

    // ─── Letters by Status ───────────────────────────────────────────────────

    public List<Map<String, Object>> getByStatus(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT status, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY status ORDER BY 2 DESC";
        return executeGroupQuery(dql, "status", "cnt");
    }

    // ─── Letters by Type Category ────────────────────────────────────────────

    public List<Map<String, Object>> getByTypeCategory(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT type_category, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY type_category ORDER BY 2 DESC";
        return executeGroupQuery(dql, "type_category", "cnt");
    }

    // ─── Letters by Nature of Correspondence ─────────────────────────────────

    public List<Map<String, Object>> getByNature(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT nature_of_correspondence, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY nature_of_correspondence ORDER BY 2 DESC";
        return executeGroupQuery(dql, "nature_of_correspondence", "cnt");
    }

    // ─── Letters by Secrecy ──────────────────────────────────────────────────

    public List<Map<String, Object>> getBySecrecy(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT secrecy, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY secrecy ORDER BY 2 DESC";
        return executeGroupQuery(dql, "secrecy", "cnt");
    }

    // ─── Letters by Priority ─────────────────────────────────────────────────

    public List<Map<String, Object>> getByPriority(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT priority, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY priority ORDER BY 2 DESC";
        return executeGroupQuery(dql, "priority", "cnt");
    }

    // ─── Letters by Vertical/Department ──────────────────────────────────────

    public List<Map<String, Object>> getByVertical(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT vertical, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY vertical ORDER BY 2 DESC ENABLE(RETURN_TOP 20)";
        return executeGroupQuery(dql, "vertical", "cnt");
    }

    // ─── Letters Trend (monthly) ─────────────────────────────────────────────
    // DATETOSTRING not supported in this Documentum version.
    // Uses per-month COUNT queries with date-range WHERE clauses.

    public List<Map<String, Object>> getTrend(Map<String, String> filters) {
        String baseWhere = buildWhereClause(filters);
        List<Map<String, Object>> results = new ArrayList<>();
        LocalDate now = LocalDate.now();

        for (int i = 11; i >= 0; i--) {
            LocalDate monthStart = now.minusMonths(i).withDayOfMonth(1);
            LocalDate monthEnd = monthStart.plusMonths(1);
            String from = monthStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String to = monthEnd.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String label = monthStart.format(DateTimeFormatter.ofPattern("yyyy-MM"));

            String dateCondition = "entry_date >= DATE('" + from + "','yyyy-mm-dd')"
                    + " AND entry_date < DATE('" + to + "','yyyy-mm-dd')";

            String dql;
            if (baseWhere.isEmpty()) {
                dql = "SELECT COUNT(*) as cnt FROM cms_digidak_folder WHERE " + dateCondition;
            } else {
                dql = "SELECT COUNT(*) as cnt FROM cms_digidak_folder" + baseWhere + " AND " + dateCondition;
            }

            long count = executeCount(dql);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", label);
            row.put("value", count);
            results.add(row);
        }

        return results;
    }

    // ─── Letters by Decision (Inward/Outward) ────────────────────────────────

    public List<Map<String, Object>> getByDecision(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT decision, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY decision";
        return executeGroupQuery(dql, "decision", "cnt");
    }

    // ─── Letters by Language ─────────────────────────────────────────────────

    public List<Map<String, Object>> getByLanguage(Map<String, String> filters) {
        String where = buildWhereClause(filters);
        String dql = "SELECT languages, COUNT(*) as cnt FROM cms_digidak_folder" + where
                + " GROUP BY languages ORDER BY 2 DESC";
        return executeGroupQuery(dql, "languages", "cnt");
    }

    // ─── Build WHERE clause from filters ─────────────────────────────────────

    private String buildWhereClause(Map<String, String> filters) {
        if (filters == null || filters.isEmpty()) return "";

        List<String> conditions = new ArrayList<>();

        addFilter(conditions, filters, "decision", "decision");
        addFilter(conditions, filters, "status", "status");
        addFilter(conditions, filters, "typeCategory", "type_category");
        addFilter(conditions, filters, "nature", "nature_of_correspondence");
        addFilter(conditions, filters, "secrecy", "secrecy");
        addFilter(conditions, filters, "priority", "priority");
        addFilter(conditions, filters, "languages", "languages");
        addFilter(conditions, filters, "modeOfReceipt", "mode_of_receipt");
        addFilter(conditions, filters, "vertical", "vertical");
        addFilter(conditions, filters, "fileNumber", "file_number");
        addFilter(conditions, filters, "loginOfficeType", "login_office_type");
        addFilter(conditions, filters, "region", "region");
        addFilter(conditions, filters, "entryType", "entry_type");
        addFilter(conditions, filters, "financialYear", "financial_year");

        if (filters.containsKey("isBulkLetter") && !filters.get("isBulkLetter").isBlank()) {
            conditions.add("is_bulk_letter = '" + safe(filters.get("isBulkLetter")) + "'");
        }

        if (filters.containsKey("fromDate") && !filters.get("fromDate").isBlank()) {
            conditions.add("entry_date >= DATE('" + safe(filters.get("fromDate")) + "','yyyy-mm-dd')");
        }
        if (filters.containsKey("toDate") && !filters.get("toDate").isBlank()) {
            conditions.add("entry_date <= DATE('" + safe(filters.get("toDate")) + "','yyyy-mm-dd')");
        }

        if (conditions.isEmpty()) return "";
        return " WHERE " + String.join(" AND ", conditions);
    }

    private void addFilter(List<String> conditions, Map<String, String> filters, String paramKey, String dqlField) {
        if (filters.containsKey(paramKey) && !filters.get(paramKey).isBlank()) {
            conditions.add(dqlField + " = '" + safe(filters.get(paramKey)) + "'");
        }
    }

    private String safe(String value) {
        return value.replace("'", "''");
    }

    private String and(String where) {
        return where.isEmpty() ? " WHERE " : " AND ";
    }

    // ─── Helper: execute COUNT ───────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private long executeCount(String dql) {
        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (resp == null) return 0;
            List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
            if (entries == null || entries.isEmpty()) return 0;
            Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
            if (content == null) return 0;
            Map<String, Object> props = (Map<String, Object>) content.get("properties");
            if (props == null) return 0;
            Object cnt = props.get("cnt");
            if (cnt instanceof Number) return ((Number) cnt).longValue();
            return Long.parseLong(String.valueOf(cnt));
        } catch (Exception e) {
            log.error("[DigidakReport] Count query failed: {}", e.getMessage());
            return 0;
        }
    }

    // ─── Helper: execute GROUP BY ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> executeGroupQuery(String dql, String categoryField, String valueField) {
        List<Map<String, Object>> results = new ArrayList<>();
        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl() + "?dql={dql}&items-per-page=100&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (resp == null) return results;
            List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
            if (entries == null) return results;

            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content == null) continue;
                Map<String, Object> props = (Map<String, Object>) content.get("properties");
                if (props == null) continue;

                Map<String, Object> row = new LinkedHashMap<>();
                Object cat = props.get(categoryField);
                row.put("category", cat != null ? String.valueOf(cat) : "Unknown");
                Object val = props.get(valueField);
                if (val instanceof Number) row.put("value", ((Number) val).longValue());
                else {
                    try { row.put("value", Long.parseLong(String.valueOf(val))); }
                    catch (NumberFormatException e) { row.put("value", 0L); }
                }
                results.add(row);
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[DigidakReport] Group query failed [{}]: {}", e.getStatusCode(), rb);
        } catch (Exception e) {
            log.error("[DigidakReport] Group query failed: {}", e.getMessage());
        }
        return results;
    }
}
