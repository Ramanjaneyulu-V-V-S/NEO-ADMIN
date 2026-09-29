package com.example.backend.service;

import com.example.backend.config.AppConfig;
import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class CaseService {

    private final DctmConfig dctmConfig;
    private final AppConfig appConfig;
    private final RestClient restClient;

    public CaseService(DctmConfig dctmConfig, AppConfig appConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.appConfig = appConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Search cases (cms_case_folder) by case number or load recent cases using DQL.
     * Uses a single DQL query to fetch all required fields, eliminating N+1 query problem.
     * If caseNumber is null/empty, loads cases from last N months (configured in properties).
     *
     * @param hoRo          office type filter: "HO" | "RO" | "TE" (blank = all)
     * @param roShortCode   location short code filter — matches against object_name pattern (blank = all)
     * @param deptNames     comma-separated department names for multi-dept filter (blank = all)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchCases(String caseNumber, String hoRo, String roShortCode,
                                            String deptNames, String departmentShortCode, String functions,
                                            String fromDate, String toDate, int page, int itemsPerPage,
                                            boolean withCount) {
        try {
            StringBuilder where = new StringBuilder();

            if (caseNumber == null || caseNumber.isBlank()) {
                int months = appConfig.getCases().getDefaultLoadMonths();
                LocalDate startDate = LocalDate.now().minusMonths(months);
                String dateStr = startDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
                where.append("r_creation_date >= DATE('").append(dateStr).append("', 'yyyy-mm-dd')");
                log.info("Loading recent cases (last {} months) from {}", months, dateStr);
            } else {
                String searchTerm = caseNumber.trim().replace("'", "''");
                where.append("object_name LIKE '%").append(searchTerm).append("%'");
                log.info("Searching cases for: {}", searchTerm);
            }

            // Office type filter
            if (hoRo != null && !hoRo.isBlank()) {
                where.append(" AND ho_ro = '").append(hoRo.trim().replace("'", "''")).append("'");
            }

            // Location short code filter (matches pattern in case number e.g. NB-RO-TN-...)
            if (roShortCode != null && !roShortCode.isBlank()) {
                String sc = roShortCode.trim().replace("'", "''").toUpperCase();
                where.append(" AND UPPER(object_name) LIKE '%-").append(sc).append("-%'");
            }

            // Multi-department filter
            if (deptNames != null && !deptNames.isBlank()) {
                String[] names = deptNames.split(",");
                StringBuilder inClause = new StringBuilder(" AND department_name IN (");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) inClause.append(", ");
                    inClause.append("'").append(names[i].trim().replace("'", "''")).append("'");
                }
                inClause.append(")");
                where.append(inClause);
            }

            // Department short code filter
            if (departmentShortCode != null && !departmentShortCode.isBlank()) {
                where.append(" AND LOWER(department_short_code) = '").append(departmentShortCode.trim().toLowerCase().replace("'", "''")).append("'");
            }

            // Vertical (functions) filter
            if (functions != null && !functions.isBlank()) {
                where.append(" AND functions = '").append(functions.trim().replace("'", "''")).append("'");
            }

            // Date range filter
            if (fromDate != null && !fromDate.isBlank()) {
                where.append(" AND r_creation_date >= DATE('").append(fromDate.trim()).append("', 'yyyy-mm-dd')");
            }

            if (toDate != null && !toDate.isBlank()) {
                // Add 1 day to include all records until 11:59 PM of the selected date
                LocalDate endDate = LocalDate.parse(toDate.trim(), DateTimeFormatter.ISO_LOCAL_DATE).plusDays(1);
                String endDateStr = endDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
                where.append(" AND r_creation_date < DATE('").append(endDateStr).append("', 'yyyy-mm-dd')");
            }

            // Exclude migrated cases
            where.append(" AND (is_migrated IS NULL OR is_migrated = FALSE)");

            String dql = String.format(
                "SELECT r_object_id, object_name, subject, ho_ro, description, " +
                "department_name, functions, r_creation_date, r_creator_name, " +
                "task_priority, status, case_nature, disposal_level, " +
                "file_number, types, language_type " +
                "FROM cms_case_folder " +
                "WHERE %s " +
                "ORDER BY r_creation_date DESC " +
                "ENABLE(RETURN_TOP %d)",
                where, page * itemsPerPage
            );

            log.info("Case search DQL filters — hoRo: {}, roShortCode: {}, deptNames: {}", hoRo, roShortCode, deptNames);

            Map<String, Object> result = executeCaseDQL(dql, page, itemsPerPage);

            // Exact total for the current filter set. Skipped on plain page navigation
            // (filters unchanged) and best-effort otherwise — if the count query can't
            // be produced the client falls back to the "N+" running estimate.
            if (withCount) {
                try {
                    long total = executeCountDQL(
                            "SELECT count(*) as total FROM cms_case_folder WHERE " + where);
                    result.put("total", total);
                } catch (Exception ce) {
                    log.warn("Case search count failed, client will show an estimate: {}", ce.getMessage());
                }
            }

            return result;

        } catch (Exception e) {
            log.error("Error in searchCases", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("cases", new ArrayList<>());
            errorResult.put("hasNext", false);
            errorResult.put("page", page);
            errorResult.put("itemsPerPage", itemsPerPage);
            errorResult.put("error", "Failed to search cases: " + e.getMessage());
            return errorResult;
        }
    }

    /**
     * Get cases report with date range filtering. Always excludes is_migrated and status='Delete'.
     * No default date window — returns all matching cases unless date range is provided.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getCasesReport(String hoRo, String location, String deptNames,
                                               String functions,
                                               String fromDate, String toDate,
                                               String status, String priority, String language,
                                               int page, int itemsPerPage) {
        try {
            StringBuilder where = new StringBuilder();
            where.append("(is_migrated IS NULL OR is_migrated = FALSE)");
            where.append(" AND status <> 'Delete'");
            where.append(" AND status <> 'Draft'");

            if (hoRo != null && !hoRo.isBlank()) {
                where.append(" AND ho_ro = '").append(hoRo.trim().replace("'", "''")).append("'");
            }

            if (location != null && !location.isBlank()) {
                where.append(" AND location = '").append(location.trim().replace("'", "''")).append("'");
            }

            if (deptNames != null && !deptNames.isBlank()) {
                String[] names = deptNames.split(",");
                StringBuilder inClause = new StringBuilder(" AND department_name IN (");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) inClause.append(", ");
                    inClause.append("'").append(names[i].trim().replace("'", "''")).append("'");
                }
                inClause.append(")");
                where.append(inClause);
            }

            if (functions != null && !functions.isBlank()) {
                String[] funcs = functions.split(",");
                where.append(" AND functions IN (");
                for (int i = 0; i < funcs.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(funcs[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (fromDate != null && !fromDate.isBlank()) {
                where.append(" AND r_creation_date >= DATE('").append(fromDate.trim()).append("', 'yyyy-mm-dd')");
            }

            if (toDate != null && !toDate.isBlank()) {
                where.append(" AND r_creation_date <= DATE('").append(toDate.trim()).append("', 'yyyy-mm-dd')");
            }

            if (status != null && !status.isBlank()) {
                String[] statuses = status.split(",");
                where.append(" AND status IN (");
                for (int i = 0; i < statuses.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(statuses[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (priority != null && !priority.isBlank()) {
                String[] priorities = priority.split(",");
                where.append(" AND task_priority IN (");
                for (int i = 0; i < priorities.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(priorities[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (language != null && !language.isBlank()) {
                String[] languages = language.split(",");
                where.append(" AND language_type IN (");
                for (int i = 0; i < languages.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(languages[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            String dql = String.format(
                "SELECT r_object_id, object_name, subject, ho_ro, description, " +
                "department_name, functions, r_creation_date, r_creator_name, " +
                "task_priority, status, case_nature, disposal_level, " +
                "file_number, types, language_type " +
                "FROM cms_case_folder " +
                "WHERE %s " +
                "ORDER BY r_creation_date DESC " +
                "ENABLE(RETURN_TOP %d)",
                where, page * itemsPerPage
            );

            log.info("Cases report DQL filters — hoRo: {}, location: {}, deptNames: {}, functions: {}, from: {}, to: {}, status: {}, priority: {}, language: {}",
                     hoRo, location, deptNames, functions, fromDate, toDate, status, priority, language);

            return executeCaseDQL(dql, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error in getCasesReport", e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("cases", new ArrayList<>());
            errorResult.put("hasNext", false);
            errorResult.put("page", page);
            errorResult.put("itemsPerPage", itemsPerPage);
            errorResult.put("error", "Failed to get cases report: " + e.getMessage());
            return errorResult;
        }
    }

    /**
     * Get total count of cases matching the report filters
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getCasesCount(String hoRo, String location, String deptNames,
                                             String functions, String fromDate, String toDate,
                                             String status, String priority, String language) {
        Map<String, Object> result = new HashMap<>();
        try {
            StringBuilder where = new StringBuilder();
            where.append("(is_migrated IS NULL OR is_migrated = FALSE)");
            where.append(" AND status <> 'Delete'");
            where.append(" AND status <> 'Draft'");

            if (hoRo != null && !hoRo.isBlank()) {
                where.append(" AND ho_ro = '").append(hoRo.trim().replace("'", "''")).append("'");
            }

            if (location != null && !location.isBlank()) {
                where.append(" AND location = '").append(location.trim().replace("'", "''")).append("'");
            }

            if (deptNames != null && !deptNames.isBlank()) {
                String[] names = deptNames.split(",");
                StringBuilder inClause = new StringBuilder(" AND department_name IN (");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) inClause.append(", ");
                    inClause.append("'").append(names[i].trim().replace("'", "''")).append("'");
                }
                inClause.append(")");
                where.append(inClause);
            }

            if (functions != null && !functions.isBlank()) {
                String[] funcs = functions.split(",");
                where.append(" AND functions IN (");
                for (int i = 0; i < funcs.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(funcs[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (fromDate != null && !fromDate.isBlank()) {
                where.append(" AND r_creation_date >= DATE('").append(fromDate.trim()).append("', 'yyyy-mm-dd')");
            }

            if (toDate != null && !toDate.isBlank()) {
                where.append(" AND r_creation_date <= DATE('").append(toDate.trim()).append("', 'yyyy-mm-dd')");
            }

            if (status != null && !status.isBlank()) {
                String[] statuses = status.split(",");
                where.append(" AND status IN (");
                for (int i = 0; i < statuses.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(statuses[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (priority != null && !priority.isBlank()) {
                String[] priorities = priority.split(",");
                where.append(" AND task_priority IN (");
                for (int i = 0; i < priorities.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(priorities[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            if (language != null && !language.isBlank()) {
                String[] languages = language.split(",");
                where.append(" AND language_type IN (");
                for (int i = 0; i < languages.length; i++) {
                    if (i > 0) where.append(", ");
                    where.append("'").append(languages[i].trim().replace("'", "''")).append("'");
                }
                where.append(")");
            }

            String dql = "SELECT count(*) as total FROM cms_case_folder WHERE " + where;
            long total = executeCountDQL(dql);
            result.put("total", total);
            log.info("Cases count result: {}", total);
        } catch (Exception e) {
            log.error("Error fetching cases count: {}", e.getMessage(), e);
            result.put("total", 0);
        }
        return result;
    }

    /**
     * Run an aggregate {@code SELECT count(*) as total ...} DQL and pull the number
     * out of the Documentum REST response. Shared by the cases-report count endpoint
     * and the cases-search total. Exceptions propagate — callers decide how to degrade.
     */
    @SuppressWarnings("unchecked")
    private long executeCountDQL(String dql) {
        log.info("Count DQL: {}", dql);

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        Map<String, Object> response = restClient.get()
                .uri(baseUrl + "?dql={dql}&inline=true", dql)
                .header("Authorization", getAuthHeader())
                .header("Accept", "application/vnd.emc.documentum+json")
                .retrieve()
                .body(Map.class);

        long total = 0;
        if (response != null) {
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
            if (entries != null && !entries.isEmpty()) {
                Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        if (props.containsKey("total")) {
                            total = toLong(props.get("total"));
                        } else if (props.containsKey("COUNT(*)")) {
                            total = toLong(props.get("COUNT(*)"));
                        } else {
                            for (Object value : props.values()) {
                                if (value instanceof Number) {
                                    total = ((Number) value).longValue();
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        return total;
    }

    /**
     * Execute a DQL query for cases and return paginated results.
     * Uses Documentum REST API with DQL parameter.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> executeCaseDQL(String dql, int page, int itemsPerPage) {
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            log.debug("Executing DQL: {}", dql);

            // Use URI templates for proper encoding (RestClient handles encoding)
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true",
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformDQLResponse(response, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error executing case DQL", e);
            throw new RuntimeException("Failed to execute DQL query: " + e.getMessage(), e);
        }
    }

    /**
     * Transform DQL response to the expected format.
     * Extracts cases from entries and preserves pagination metadata.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> transformDQLResponse(Map<String, Object> response, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("cases", new ArrayList<>());
            result.put("hasNext", false);
            result.put("page", page);
            result.put("itemsPerPage", itemsPerPage);
            return result;
        }

        // Extract cases from entries
        List<Map<String, Object>> cases = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        // All fields are already present in DQL result
                        // No need for additional API calls
                        cases.add(props);
                    }
                }
            }
        }

        result.put("cases", cases);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);

        // Check for next link to determine if there are more pages
        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        log.info("Transformed {} cases for page {}, hasNext: {}", cases.size(), page, hasNext);

        return result;
    }

    private long toLong(Object obj) {
        if (obj == null) return 0;
        if (obj instanceof Number) return ((Number) obj).longValue();
        try {
            return Long.parseLong(obj.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
