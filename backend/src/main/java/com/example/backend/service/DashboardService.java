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
public class DashboardService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public DashboardService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
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

    // ─── KPI Summary ─────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Map<String, Object> getSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        String firstOfMonth = LocalDate.now().withDayOfMonth(1).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

        summary.put("totalCases", executeCount("SELECT COUNT(*) as cnt FROM cms_case_folder"));
        summary.put("casesThisMonth", executeCount(
                "SELECT COUNT(*) as cnt FROM cms_case_folder WHERE r_creation_date >= DATE('" + firstOfMonth + "','yyyy-mm-dd')"));
        summary.put("activeWorkflows", executeCount(
                "SELECT COUNT(*) as cnt FROM dm_workflow WHERE r_runtime_state = 1"));
        summary.put("activeUsers", executeCount(
                "SELECT COUNT(*) as cnt FROM cms_user_profile WHERE is_active = 1"));

        return summary;
    }

    // ─── Cases by Department (top 15) ────────────────────────────────────────

    public List<Map<String, Object>> getCasesByDepartment() {
        String dql = "SELECT department_name, COUNT(*) as case_count FROM cms_case_folder"
                + " GROUP BY department_name ORDER BY 2 DESC ENABLE(RETURN_TOP 15)";
        return executeGroupQuery(dql, "department_name", "case_count");
    }

    // ─── Cases by Status ─────────────────────────────────────────────────────

    public List<Map<String, Object>> getCasesByStatus() {
        String dql = "SELECT status, COUNT(*) as case_count FROM cms_case_folder"
                + " GROUP BY status ORDER BY 2 DESC";
        return executeGroupQuery(dql, "status", "case_count");
    }

    // ─── Cases by Office Type ────────────────────────────────────────────────

    public List<Map<String, Object>> getCasesByOffice() {
        String dql = "SELECT ho_ro, COUNT(*) as case_count FROM cms_case_folder"
                + " GROUP BY ho_ro";
        return executeGroupQuery(dql, "ho_ro", "case_count");
    }

    // ─── Case Creation Trend (last 12 months) ────────────────────────────────
    // DATETOSTRING is not supported in this Documentum version,
    // so we query COUNT per month using date-range WHERE clauses.

    public List<Map<String, Object>> getCasesTrend() {
        List<Map<String, Object>> results = new ArrayList<>();
        LocalDate now = LocalDate.now();

        for (int i = 11; i >= 0; i--) {
            LocalDate monthStart = now.minusMonths(i).withDayOfMonth(1);
            LocalDate monthEnd = monthStart.plusMonths(1);
            String from = monthStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String to = monthEnd.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String label = monthStart.format(DateTimeFormatter.ofPattern("yyyy-MM"));

            String dql = "SELECT COUNT(*) as cnt FROM cms_case_folder"
                    + " WHERE r_creation_date >= DATE('" + from + "','yyyy-mm-dd')"
                    + " AND r_creation_date < DATE('" + to + "','yyyy-mm-dd')";

            long count = executeCount(dql);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", label);
            row.put("value", count);
            results.add(row);
        }

        return results;
    }

    // ─── Workflow Status Distribution ────────────────────────────────────────

    public List<Map<String, Object>> getWorkflowStatus() {
        String dql = "SELECT r_runtime_state, COUNT(*) as wf_count FROM dm_workflow"
                + " GROUP BY r_runtime_state";
        List<Map<String, Object>> raw = executeGroupQuery(dql, "r_runtime_state", "wf_count");

        // Map numeric states to labels
        Map<String, String> stateLabels = Map.of(
                "0", "Dormant", "1", "Running", "2", "Finished",
                "3", "Halted", "4", "Terminated", "5", "Failed");

        for (Map<String, Object> row : raw) {
            String state = String.valueOf(row.get("category"));
            row.put("category", stateLabels.getOrDefault(state, "Unknown (" + state + ")"));
        }
        return raw;
    }

    // ─── Cases by Priority ───────────────────────────────────────────────────

    public List<Map<String, Object>> getCasesByPriority() {
        String dql = "SELECT task_priority, COUNT(*) as case_count FROM cms_case_folder"
                + " GROUP BY task_priority ORDER BY 2 DESC";
        return executeGroupQuery(dql, "task_priority", "case_count");
    }

    // ─── Users by Office Type ────────────────────────────────────────────────

    public List<Map<String, Object>> getUsersByOffice() {
        String dql = "SELECT office_type, COUNT(*) as user_count FROM cms_user_profile"
                + " WHERE is_active = 1 GROUP BY office_type";
        return executeGroupQuery(dql, "office_type", "user_count");
    }

    // ─── Helper: execute COUNT query ─────────────────────────────────────────

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
            log.error("[Dashboard] Count query failed: {}", e.getMessage());
            return 0;
        }
    }

    // ─── Helper: execute GROUP BY query ──────────────────────────────────────

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
                if (val instanceof Number) {
                    row.put("value", ((Number) val).longValue());
                } else {
                    try { row.put("value", Long.parseLong(String.valueOf(val))); }
                    catch (NumberFormatException e) { row.put("value", 0L); }
                }
                results.add(row);
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Dashboard] Group query failed [{}]: {}", e.getStatusCode(), rb);
        } catch (Exception e) {
            log.error("[Dashboard] Group query failed: {}", e.getMessage());
        }

        return results;
    }
}
