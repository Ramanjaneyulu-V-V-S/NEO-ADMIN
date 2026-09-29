package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class MetadataService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public MetadataService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Creates a cms_file_number object under /ECM CONFIG/File Number.
     * Fetches the parent folder's acl_name and applies it to the new object.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createFileNumber(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Step 1 — resolve /ECM CONFIG/File Number: get r_object_id, acl_name AND acl_domain
        String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                + " WHERE ANY r_folder_path = '/ECM CONFIG/File Number'";
        log.info("[FileNumber] Resolving folder /ECM CONFIG/File Number");
        Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, "/ECM CONFIG/File Number");
        String folderId   = folderInfo.get("r_object_id");
        String aclName    = folderInfo.get("acl_name");
        String aclDomain  = folderInfo.get("acl_domain");
        log.info("[FileNumber] folder={} acl={} aclDomain={}", folderId, aclName, aclDomain);

        // Step 2 — build properties
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type",  "cms_file_number");
        props.put("object_name",    request.get("object_name"));
        props.put("ho_ro",          request.get("ho_ro"));
        props.put("dept_short_code",request.get("dept_short_code"));
        String roShortCode = (String) request.getOrDefault("ro_short_code", "");
        props.put("ro_short_code",  roShortCode != null ? roShortCode : "");
        Object desc = request.get("description");
        if (desc != null) props.put("description", desc);
        if (aclName  != null && !aclName.isBlank())  props.put("acl_name",   aclName);
        if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

        // Step 3 — POST to /folders/{folderId}/objects
        String createUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + folderId + "/objects";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[FileNumber] Creating '{}' ho_ro='{}' dept='{}' ro='{}'",
                request.get("object_name"), request.get("ho_ro"),
                request.get("dept_short_code"), roShortCode);
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept",       "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "File number '" + request.get("object_name") + "' created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Updates object_name and/or description of a cms_file_number by its r_object_id.
     * PUT /repositories/{repo}/objects/{objectId}
     */
    public Map<String, Object> updateFileNumber(String objectId, Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        Map<String, Object> props = new LinkedHashMap<>();
        if (request.containsKey("object_name")) props.put("object_name", request.get("object_name"));
        if (request.containsKey("description")) props.put("description", request.get("description"));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);
        log.info("[FileNumber] Updating object '{}' with {}", objectId, props.keySet());
        try {
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",       "application/vnd.emc.documentum+json")
                    .header("X-HTTP-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[FileNumber] Updated '{}'", objectId);
            return Map.of("success", true, "message", "File number updated successfully");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] Update failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number update failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Validates if a file number can be deleted by checking if any cases use it.
     * Parameters: hoRo, deptShortCode, fileNumber, roShortCode (for RO/TE)
     * Returns a map with:
     * - canDelete: boolean (true if no cases found, false if cases exist)
     * - caseCount: number of cases using this file number (0 if can delete)
     * - message: human-readable message
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> validateFileNumberDelete(String hoRo, String deptShortCode, String fileNumber, String roShortCode) {
        try {
            // Validate inputs
            if (hoRo == null || deptShortCode == null || fileNumber == null) {
                return Map.of("canDelete", false, "caseCount", 0,
                    "message", "File number incomplete");
            }

            String hoRoVal = hoRo;

            // Build DQL query based on office type
            StringBuilder dql = new StringBuilder("SELECT r_object_id FROM cms_case_folder WHERE ");

            if ("HO".equals(hoRoVal)) {
                // HO: check ho_ro, department_short_code, file_number, is_migrated
                String safeDept = deptShortCode.replace("'", "''");
                String safeFileNum = fileNumber.replace("'", "''");
                dql.append("ho_ro = 'HO' ")
                   .append("AND department_short_code = '").append(safeDept).append("' ")
                   .append("AND file_number = '").append(safeFileNum).append("' ")
                   .append("AND is_migrated = false");
            } else if ("RO".equals(hoRoVal) || "TE".equals(hoRoVal)) {
                // RO/TE: check ho_ro, department_short_code, title (location), file_number, is_migrated
                String safeDept = deptShortCode.replace("'", "''");
                String safeFileNum = fileNumber.replace("'", "''");
                String safeRoCode = roShortCode != null ? roShortCode.replace("'", "''") : "";
                dql.append("ho_ro = '").append(hoRoVal).append("' ")
                   .append("AND department_short_code = '").append(safeDept).append("' ")
                   .append("AND title = '").append(safeRoCode).append("' ")
                   .append("AND file_number = '").append(safeFileNum).append("' ")
                   .append("AND is_migrated = false");
            } else {
                return Map.of("canDelete", false, "caseCount", 0,
                    "message", "Invalid office type");
            }

            log.info("[FileNumber] Validating delete - DQL: {}", dql);

            // Execute DQL to find matching cases
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            Map<String, Object> queryResp = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page=1000&page=1&inline=true", dql.toString())
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (queryResp == null) {
                return Map.of("canDelete", true, "caseCount", 0,
                    "message", "No cases found using this file number");
            }

            List<Map<String, Object>> entries = (List<Map<String, Object>>) queryResp.get("entries");
            int caseCount = (entries != null) ? entries.size() : 0;

            if (caseCount > 0) {
                return Map.of("canDelete", false, "caseCount", caseCount,
                    "message", caseCount + " case(s) found using this file number. Cannot delete.");
            } else {
                return Map.of("canDelete", true, "caseCount", 0,
                    "message", "No cases found using this file number");
            }

        } catch (Exception e) {
            log.error("[FileNumber] Validation failed: {}", e.getMessage(), e);
            return Map.of("canDelete", false, "caseCount", 0,
                "message", "Validation check failed: " + e.getMessage());
        }
    }

    /**
     * Deletes a cms_file_number object by its r_object_id.
     * DELETE /repositories/{repo}/objects/{objectId}
     */
    public Map<String, Object> deleteFileNumber(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        log.info("[FileNumber] Deleting object '{}'", objectId);
        try {
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
            log.info("[FileNumber] Deleted '{}'", objectId);
            return Map.of("success", true, "message", "File number deleted successfully");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] Delete failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number deletion failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Checks if a file number already exists for the given office type, department, and location.
     * Returns { "exists": true/false }
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkFileNumberDuplicate(String hoRo, String deptShortCode, String fileNumber, String roShortCode) {
        try {
            String safe_hoRo = hoRo.replace("'", "''");
            String safe_dept = deptShortCode.replace("'", "''");
            String safe_fileName = fileNumber.replace("'", "''");

            StringBuilder dql = new StringBuilder(
                    "SELECT r_object_id FROM cms_file_number"
                    + " WHERE ho_ro = '" + safe_hoRo + "'"
                    + " AND dept_short_code = '" + safe_dept + "'"
                    + " AND object_name = '" + safe_fileName + "'");

            if (roShortCode != null && !roShortCode.isBlank()) {
                String safe_ro = roShortCode.replace("'", "''");
                dql.append(" AND ro_short_code = '").append(safe_ro).append("'");
            }

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            log.info("[FileNumber] Checking duplicate: {}", dql);

            Map<String, Object> resp = restClient.get()
                    .uri(baseUrl + "?dql={dql}&items-per-page=1&inline=true", dql.toString())
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (resp == null) {
                return Map.of("exists", false);
            }

            List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
            boolean exists = entries != null && !entries.isEmpty();

            return Map.of("exists", exists);
        } catch (Exception e) {
            log.error("[FileNumber] Duplicate check failed: {}", e.getMessage(), e);
            return Map.of("exists", false);
        }
    }

    /**
     * Lists existing cms_file_number objects filtered by ho_ro, dept_short_code,
     * and optionally ro_short_code (for RO/TE).
     *
     * GET /api/metadata/file-numbers?hoRo=HO&deptShortCode=fsdd
     * GET /api/metadata/file-numbers?hoRo=RO&deptShortCode=bid&roShortCode=jk
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFileNumbers(String hoRo, String deptShortCode, String roShortCode) {
        String safe_hoRo = hoRo.replace("'", "''");
        String safe_dept = deptShortCode.replace("'", "''");

        StringBuilder dql = new StringBuilder(
                "SELECT r_object_id, object_name, description, ho_ro, dept_short_code, ro_short_code"
                + " FROM cms_file_number"
                + " WHERE ho_ro = '" + safe_hoRo + "'"
                + " AND dept_short_code = '" + safe_dept + "'");
        if (roShortCode != null && !roShortCode.isBlank()) {
            dql.append(" AND ro_short_code = '").append(roShortCode.replace("'", "''")).append("'");
        }
        dql.append(" ORDER BY object_name");

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        final int PAGE_SIZE = 100;
        List<Map<String, Object>> allResults = new ArrayList<>();
        int page = 1;

        log.info("[FileNumber] Listing all pages: {}", dql);
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql.toString(), PAGE_SIZE, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;

                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> p = (Map<String, Object>) content.get("properties");
                            if (p != null) allResults.add(p);
                        }
                    }
                }

                // Check for a "next" link — stop if there are no more pages
                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[FileNumber] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("File number list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[FileNumber] Total fetched: {}", allResults.size());
        return allResults;
    }

    /**
     * Creates a cms_digidak_metadata object under the given Digidak config folder.
     * Body: { input, results, folder_path }
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createDigidakMetadata(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        String input      = (String) request.get("input");
        String results    = (String) request.get("results");
        String folderPath = (String) request.get("folder_path");

        // Resolve folder: r_object_id, acl_name, acl_domain
        String safePath = folderPath.replace("'", "''");
        String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                + " WHERE ANY r_folder_path = '" + safePath + "'";
        log.info("[Digidak] Resolving folder '{}'", folderPath);
        Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, folderPath);
        String folderId  = folderInfo.get("r_object_id");
        String aclName   = folderInfo.get("acl_name");
        String aclDomain = folderInfo.get("acl_domain");
        log.info("[Digidak] folder={} acl={} aclDomain={}", folderId, aclName, aclDomain);

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type", "cms_digidak_metadata");
        props.put("object_name",   results);
        props.put("input",         input);
        props.put("results",       results);
        if (aclName   != null && !aclName.isBlank())   props.put("acl_name",   aclName);
        if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

        String createUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + folderId + "/objects";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[Digidak] Creating input='{}' results='{}'", input, results);
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept",       "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "'" + results + "' added successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Digidak] Create failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Lists cms_digidak_metadata objects filtered by input value.
     * DQL: SELECT r_object_id, results FROM cms_digidak_metadata WHERE input = '...' ORDER BY results ASC
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDigidakMetadata(String input) {
        String safeInput = input.replace("'", "''");
        String dql = "SELECT r_object_id, results FROM cms_digidak_metadata"
                + " WHERE input = '" + safeInput + "' ORDER BY results ASC";

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        final int PAGE_SIZE = 100;
        List<Map<String, Object>> allResults = new ArrayList<>();
        int page = 1;

        log.info("[Digidak] Listing input='{}': {}", input, dql);
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql, PAGE_SIZE, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;

                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> p = (Map<String, Object>) content.get("properties");
                            if (p != null) allResults.add(p);
                        }
                    }
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Digidak] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[Digidak] Total fetched for input='{}': {}", input, allResults.size());
        return allResults;
    }

    /**
     * Updates results (and object_name) of a cms_digidak_metadata object.
     * Uses POST + X-HTTP-Method-Override: PATCH (same pattern as group update).
     */
    public Map<String, Object> updateDigidakMetadata(String objectId, Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        Map<String, Object> props = new LinkedHashMap<>();
        if (request.containsKey("results")) {
            props.put("results",     request.get("results"));
            props.put("object_name", request.get("results")); // keep object_name in sync
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);
        log.info("[Digidak] Updating object '{}'", objectId);
        try {
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",       "application/vnd.emc.documentum+json")
                    .header("X-HTTP-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[Digidak] Updated '{}'", objectId);
            return Map.of("success", true, "message", "Updated successfully");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Digidak] Update failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata update failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Deletes a cms_digidak_metadata object by its r_object_id.
     */
    public Map<String, Object> deleteDigidakMetadata(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        log.info("[Digidak] Deleting object '{}'", objectId);
        try {
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
            log.info("[Digidak] Deleted '{}'", objectId);
            return Map.of("success", true, "message", "Deleted successfully");
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Digidak] Delete failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Digidak metadata deletion failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Creates a dm_folder with the given object_name under /ECM CONFIG/Case Type.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createCaseType(String objectName) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Resolve parent folder with acl_name and acl_domain
        String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                + " WHERE ANY r_folder_path = '/ECM CONFIG/Case Type'";
        log.info("[CaseType] Resolving /ECM CONFIG/Case Type");
        Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, "/ECM CONFIG/Case Type");
        String folderId  = folderInfo.get("r_object_id");
        String aclName   = folderInfo.get("acl_name");
        String aclDomain = folderInfo.get("acl_domain");
        log.info("[CaseType] folder={} acl={} aclDomain={}", folderId, aclName, aclDomain);

        // Create folder
        String createUrl = repoUrl + "/folders/" + folderId + "/folders";
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("object_name", objectName);
        if (aclName   != null && !aclName.isBlank())   props.put("acl_name",   aclName);
        if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[CaseType] Creating case type '{}'", objectName);
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Case type '" + objectName + "' created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[CaseType] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Case type creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Lists existing case type dm_folder objects under /ECM CONFIG/Case Type.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listCaseTypes() {
        String dql = "SELECT r_object_id, object_name FROM dm_folder"
                + " WHERE FOLDER('/ECM CONFIG/Case Type') ORDER BY object_name";

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        final int PAGE_SIZE = 100;
        List<Map<String, Object>> allResults = new ArrayList<>();
        int page = 1;

        log.info("[CaseType] Listing case types");
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql, PAGE_SIZE, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;

                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> p = (Map<String, Object>) content.get("properties");
                            if (p != null) allResults.add(p);
                        }
                    }
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[CaseType] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Case type list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[CaseType] Total: {}", allResults.size());
        return allResults;
    }

    // ─── Hindi Comments ────────────────────────────────────────────────────────

    /**
     * Creates a dm_folder with the given object_name under /ECM CONFIG/Hindi Comments.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createHindiComment(String objectName) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        String folderDql = "SELECT r_object_id, acl_name, acl_domain FROM dm_folder"
                + " WHERE ANY r_folder_path = '/ECM CONFIG/Hindi Comments'";
        log.info("[HindiComments] Resolving /ECM CONFIG/Hindi Comments");
        Map<String, String> folderInfo = resolveFolderInfo(repoUrl, folderDql, "/ECM CONFIG/Hindi Comments");
        String folderId  = folderInfo.get("r_object_id");
        String aclName   = folderInfo.get("acl_name");
        String aclDomain = folderInfo.get("acl_domain");
        log.info("[HindiComments] folder={} acl={} aclDomain={}", folderId, aclName, aclDomain);

        String createUrl = repoUrl + "/folders/" + folderId + "/folders";
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("object_name", objectName);
        if (aclName   != null && !aclName.isBlank())   props.put("acl_name",   aclName);
        if (aclDomain != null && !aclDomain.isBlank()) props.put("acl_domain", aclDomain);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[HindiComments] Creating hindi comment '{}'", objectName);
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Hindi comment '" + objectName + "' created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[HindiComments] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Hindi comment creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    /**
     * Lists existing hindi comment dm_folder objects under /ECM CONFIG/Hindi Comments.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listHindiComments() {
        String dql = "SELECT r_object_id, object_name FROM dm_folder"
                + " WHERE FOLDER('/ECM CONFIG/Hindi Comments') ORDER BY object_name";

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        final int PAGE_SIZE = 100;
        List<Map<String, Object>> allResults = new ArrayList<>();
        int page = 1;

        log.info("[HindiComments] Listing hindi comments");
        try {
            while (true) {
                Map<String, Object> resp = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={size}&page={page}&inline=true",
                                dql, PAGE_SIZE, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                if (resp == null) break;

                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null) {
                    for (Map<String, Object> entry : entries) {
                        Map<String, Object> content = (Map<String, Object>) entry.get("content");
                        if (content != null) {
                            Map<String, Object> p = (Map<String, Object>) content.get("properties");
                            if (p != null) allResults.add(p);
                        }
                    }
                }

                List<Map<String, Object>> links = (List<Map<String, Object>>) resp.get("links");
                boolean hasNext = links != null && links.stream()
                        .anyMatch(l -> "next".equals(l.get("rel")));
                if (!hasNext) break;
                page++;
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[HindiComments] List failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Hindi comments list failed [" + e.getStatusCode() + "]: " + rb);
        }

        log.info("[HindiComments] Total: {}", allResults.size());
        return allResults;
    }

    /** Resolves a folder by DQL, returning its r_object_id and acl_name. */
    @SuppressWarnings("unchecked")
    private Map<String, String> resolveFolderInfo(String repoUrl, String dql, String label) {
        try {
            Map<String, Object> resp = restClient.get()
                    .uri(repoUrl + "?dql={dql}&items-per-page=1&inline=true", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (resp != null) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) resp.get("entries");
                if (entries != null && !entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null) {
                        Map<String, Object> p = (Map<String, Object>) content.get("properties");
                        if (p != null && p.get("r_object_id") != null) {
                            Map<String, String> info = new HashMap<>();
                            info.put("r_object_id", (String) p.get("r_object_id"));
                            info.put("acl_name",    p.get("acl_name")   != null ? (String) p.get("acl_name")   : "");
                            info.put("acl_domain",  p.get("acl_domain") != null ? (String) p.get("acl_domain") : "");
                            return info;
                        }
                    }
                }
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new RuntimeException("Could not resolve " + label + " [" + e.getStatusCode() + "]: " + rb);
        }
        throw new RuntimeException("Could not find folder '" + label + "' — check the path exists in Documentum");
    }
}
