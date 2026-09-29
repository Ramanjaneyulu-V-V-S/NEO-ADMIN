package com.example.backend.service;

import com.example.backend.config.AppConfig;
import com.example.backend.config.DctmConfig;
import com.example.backend.config.ProcessConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

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
public class DelegateService {

    private final DctmConfig dctmConfig;
    private final AppConfig appConfig;
    private final ProcessConfig processConfig;
    private final RestClient restClient;

    public DelegateService(DctmConfig dctmConfig, AppConfig appConfig,
                           ProcessConfig processConfig,
                           RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.appConfig = appConfig;
        this.processConfig = processConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        return "Basic " + Base64.getEncoder().encodeToString(
                (dctmConfig.getUsername() + ":" + dctmConfig.getPassword())
                        .getBytes(StandardCharsets.UTF_8));
    }

    private String getRepoUrl() {
        return dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
    }

    // ─── Case Search ─────────────────────────────────────────────────────────────

    /**
     * Search cms_case_folder objects with optional office-type, department, and location filters.
     *
     * @param query         case number search term (blank = recent cases)
     * @param hoRo          office type filter: "HO" | "RO" | "TE" (blank = all)
     * @param deptName      single department_name filter (blank = all)
     * @param deptNames     comma-separated department names for multi-dept filter (blank = all)
     * @param roShortCode   location short code filter — matches against object_name pattern (blank = all)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchCases(String query, String hoRo, String deptName,
                                            String deptNames, String roShortCode,
                                            int page, int itemsPerPage) {
        try {
            // Build WHERE clauses
            StringBuilder where = new StringBuilder();

            boolean hasHoRo = hoRo != null && !hoRo.isBlank();
            boolean hasDept  = deptName != null && !deptName.isBlank();
            boolean hasQuery = query != null && !query.isBlank();

            if (hasQuery) {
                String term = query.trim().replace("'", "''");
                where.append("object_name LIKE '%").append(term).append("%'");
            } else {
                int months = appConfig.getCases().getDefaultLoadMonths();
                String dateStr = LocalDate.now().minusMonths(months)
                        .format(DateTimeFormatter.ISO_LOCAL_DATE);
                where.append("r_creation_date >= DATE('").append(dateStr).append("', 'yyyy-mm-dd')");
            }

            if (hasHoRo) {
                where.append(" AND ho_ro = '").append(hoRo.trim().replace("'", "''")).append("'");
            }
            if (hasDept) {
                where.append(" AND department_name = '").append(deptName.trim().replace("'", "''")).append("'");
            }

            // Multi-department filter (comma-separated list of department names)
            boolean hasDeptNames = !hasDept && deptNames != null && !deptNames.isBlank();
            if (hasDeptNames) {
                String[] names = deptNames.split(",");
                StringBuilder inClause = new StringBuilder(" AND department_name IN (");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) inClause.append(", ");
                    inClause.append("'").append(names[i].trim().replace("'", "''")).append("'");
                }
                inClause.append(")");
                where.append(inClause);
            }

            boolean hasRoShortCode = roShortCode != null && !roShortCode.isBlank();
            if (hasRoShortCode) {
                String sc = roShortCode.trim().replace("'", "''").toUpperCase();
                where.append(" AND UPPER(object_name) LIKE '%-").append(sc).append("-%'");
            }

            // Exclude migrated cases
            where.append(" AND (is_migrated IS NULL OR is_migrated = FALSE)");

            String dql = String.format(
                    "SELECT r_object_id, object_name, subject, ho_ro, description, " +
                    "department_name, r_creation_date, functions, task_priority, status, " +
                    "case_nature, disposal_level, file_number, types, r_creator_name, language_type " +
                    "FROM cms_case_folder " +
                    "WHERE %s " +
                    "ORDER BY r_creation_date DESC " +
                    "ENABLE(RETURN_TOP %d)",
                    where, page * itemsPerPage);

            log.info("Case search DQL filters — hoRo: {}, dept: {}, roShortCode: {}, query: {}", hoRo, deptName, roShortCode, query);

            Map<String, Object> response = restClient.get()
                    .uri(getRepoUrl() + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                         dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformCaseResponse(response, page, itemsPerPage);

        } catch (Exception e) {
            log.error("Error searching cases", e);
            Map<String, Object> err = new HashMap<>();
            err.put("cases", new ArrayList<>());
            err.put("hasNext", false);
            err.put("page", page);
            err.put("itemsPerPage", itemsPerPage);
            err.put("error", "Failed to search cases: " + e.getMessage());
            return err;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformCaseResponse(Map<String, Object> response,
                                                       int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> cases = new ArrayList<>();

        if (response != null) {
            List<Map<String, Object>> entries =
                    (List<Map<String, Object>>) response.get("entries");
            if (entries != null) {
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        if (props != null) cases.add(props);
                    }
                }
            }
        }

        result.put("cases", cases);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);

        List<Map<String, Object>> links = response != null
                ? (List<Map<String, Object>>) response.get("links") : null;
        boolean hasNext = links != null &&
                links.stream().anyMatch(l -> "next".equals(l.get("rel")));
        result.put("hasNext", hasNext);
        return result;
    }

    // ─── Movement Register ────────────────────────────────────────────────────────

    /**
     * Fetch all valid cms_movement_register records linked to a case folder.
     * SELECT * FROM cms_movement_register WHERE ANY i_folder_id = '<caseId>' AND is_valid_entry = true
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getMovementRegister(String caseId) {
        String safe = caseId.replace("'", "''");
        String dql  = "SELECT * FROM cms_movement_register WHERE ANY i_folder_id = '" + safe + "' AND is_valid_entry = true ORDER BY r_creation_date DESC";
        log.info("Movement register DQL for case {}", caseId);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(getRepoUrl() + "?dql={dql}&items-per-page=200&page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> records = new ArrayList<>();
            if (response != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> props = (Map<String, Object>) content.get("properties");
                            if (props != null) records.add(props);
                        }
                    }
                }
            }
            return records;
        } catch (Exception e) {
            log.error("Error fetching movement register for case {}: {}", caseId, e.getMessage());
            return new ArrayList<>();
        }
    }

    // ─── Delegate Case ────────────────────────────────────────────────────────────

    /**
     * Delegate a case to the specified performer.
     * Orchestrates 3 DQL lookups then calls the xCP process service.
     *
     * @param caseId              r_object_id of the cms_case_folder
     * @param performerDisplayName object_name of the target user (shown in xCP workflow)
     * @param loginUsername        username of the logged-in user (delegating the case)
     */
    public Map<String, Object> delegateCase(String caseId, String performerDisplayName, String loginUsername) {
        // Sub-call A: resolve workflow ID from dmi_package
        String workflowId = resolveWorkflowId(caseId);
        log.info("Resolved workflowId {} for case {}", workflowId, caseId);

        // Sub-call B: resolve queue item ID from dmi_queue_item
        String qitemId = resolveQueueItemId(workflowId);
        log.info("Resolved qitemId {} for workflow {}", qitemId, workflowId);

        // Sub-call C: call process service with login username as assigned_user
        return callProcessService(caseId, loginUsername, performerDisplayName, qitemId);
    }

    @SuppressWarnings("unchecked")
    private String resolveWorkflowId(String caseId) {
        String dql = String.format(
                "SELECT r_workflow_id FROM dmi_package WHERE ANY r_component_id = '%s'",
                caseId.replace("'", "''"));

        Map<String, Object> response = restClient.get()
                .uri(getRepoUrl() + "?dql={dql}&items-per-page=1&page=1&inline=true", dql)
                .header("Authorization", getAuthHeader())
                .header("Accept", "application/vnd.emc.documentum+json")
                .retrieve()
                .body(Map.class);

        return extractFirstProperty(response, "r_workflow_id",
                "No workflow found for case: " + caseId);
    }


    @SuppressWarnings("unchecked")
    private String resolveQueueItemId(String workflowId) {
        String dql = String.format(
                "SELECT item_id FROM dmi_queue_item WHERE router_id = '%s'",
                workflowId.replace("'", "''"));

        Map<String, Object> response = restClient.get()
                .uri(getRepoUrl() + "?dql={dql}&items-per-page=1&page=1&inline=true", dql)
                .header("Authorization", getAuthHeader())
                .header("Accept", "application/vnd.emc.documentum+json")
                .retrieve()
                .body(Map.class);

        return extractFirstProperty(response, "item_id",
                "No queue item found for workflow: " + workflowId);
    }

    @SuppressWarnings("unchecked")
    private String extractFirstProperty(Map<String, Object> response,
                                         String propertyName, String errorMessage) {
        if (response == null) throw new RuntimeException(errorMessage);
        List<Map<String, Object>> entries =
                (List<Map<String, Object>>) response.get("entries");
        if (entries == null || entries.isEmpty()) throw new RuntimeException(errorMessage);

        Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
        if (content == null) throw new RuntimeException(errorMessage);

        Map<String, Object> props = (Map<String, Object>) content.get("properties");
        if (props == null || !props.containsKey(propertyName))
            throw new RuntimeException(errorMessage);

        Object value = props.get(propertyName);
        return value != null ? value.toString() : "";
    }

    private Map<String, Object> callProcessService(String caseId, String assignedUser,
                                                    String performer, String qitemId) {
        String url = processConfig.getUrl() + "/processes/cms_push_back_pull_back";

        Map<String, Object> variables = new HashMap<>();
        variables.put("decision", "Delegate");
        variables.put("assigned_user", assignedUser);
        variables.put("performer", performer);
        variables.put("qitem_id", List.of(qitemId));
        variables.put("message_to_notify", "Case Delegated");

        Map<String, Object> casePackageProps = new HashMap<>();
        casePackageProps.put("id", caseId);

        Map<String, Object> casePackage = new HashMap<>();
        casePackage.put("properties", casePackageProps);
        casePackage.put("href", "folders/cms_case_folder/" + caseId);

        Map<String, Object> packages = new HashMap<>();
        packages.put("Case", casePackage);

        Map<String, Object> data = new HashMap<>();
        data.put("variables", variables);
        data.put("packages", packages);

        Map<String, Object> body = new HashMap<>();
        body.put("run-stateless", "true");
        body.put("data", data);

        log.info("Calling process service: POST {} | assigned_user={}, performer={}, caseId={}", url, assignedUser, performer, caseId);

        // The xCP elevate activity can fail transiently on the first call
        // (DM_GROUP_E_NOT_DYNAMIC_MEMBER). Retry once after a brief pause.
        int maxAttempts = 2;
        RestClientResponseException lastException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                restClient.post()
                        .uri(url)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();

                if (attempt > 1) {
                    log.info("Process service succeeded on attempt {}", attempt);
                }
                return Map.of("success", true, "message", "Case delegated successfully to " + performer);

            } catch (RestClientResponseException e) {
                lastException = e;
                log.warn("Process service attempt {} failed [{}]: {}", attempt, e.getStatusCode(), e.getResponseBodyAsString());

                if (attempt < maxAttempts) {
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }

        throw new RuntimeException("Delegation failed [" + lastException.getStatusCode() + "]: "
                + lastException.getResponseBodyAsString(), lastException);
    }
}
