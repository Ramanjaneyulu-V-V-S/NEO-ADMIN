package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import com.example.backend.config.IvConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class IvPublicationService {

    private static final int BULK_PAGE_SIZE = 500;
    private static final int BULK_MAX_DOCUMENTS = 5000;

    private final DctmConfig dctmConfig;
    private final IvConfig ivConfig;
    private final DctmAuthService authService;
    private final RestClient restClient;

    public IvPublicationService(DctmConfig dctmConfig,
            IvConfig ivConfig,
            DctmAuthService authService,
            RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.ivConfig = ivConfig;
        this.authService = authService;
        this.restClient = restClientBuilder.build();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> findNoteDocumentId(String caseObjectId) {
        Map<String, Object> result = new HashMap<>();
        try {
            String safeId = caseObjectId.trim().replace("'", "''");
            String dql = "SELECT r_object_id, object_name FROM cms_note_document " +
                    "WHERE ANY i_folder_id = '" + safeId + "' ENABLE(RETURN_TOP 1)";
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&items-per-page=1", dql)
                    .header("Authorization", authService.getUserAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            String noteDocumentId = null;
            if (response != null && response.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
                if (!entries.isEmpty()) {
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                    if (content != null && content.containsKey("properties")) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        noteDocumentId = (String) props.get("r_object_id");
                    }
                }
            }

            if (noteDocumentId == null) {
                result.put("success", false);
                result.put("error", "No note document found for case " + caseObjectId);
                return result;
            }

            result.put("success", true);
            result.put("noteDocumentId", noteDocumentId);
            return result;
        } catch (Exception e) {
            log.error("Error finding note document for case {}: {}", caseObjectId, e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to find note document: " + e.getMessage());
            return result;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> listCaseDocuments(String caseObjectId) {
        Map<String, Object> result = new HashMap<>();
        try {
            String safeId = caseObjectId.trim().replace("'", "''");
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
            List<Map<String, Object>> documents = new ArrayList<>();

            documents.addAll(queryDocuments(baseUrl,
                    "SELECT r_object_id, object_name, r_modify_date FROM cms_note_document " +
                            "WHERE ANY i_folder_id = '" + safeId + "'",
                    "Notesheet"));
            documents.addAll(queryDocuments(baseUrl,
                    "SELECT r_object_id, object_name, r_modify_date, category FROM cms_supporting_document " +
                            "WHERE ANY i_folder_id = '" + safeId + "' ORDER BY category, object_name",
                    null));

            result.put("success", true);
            result.put("documents", documents);
            return result;
        } catch (Exception e) {
            log.error("Error listing documents for case {}: {}", caseObjectId, e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to list case documents: " + e.getMessage());
            return result;
        }
    }

    /**
     * Lists notesheets and supporting documents (draft / final / other) whose modify date falls
     * within [from, to] inclusive. Results are capped at {@link #BULK_MAX_DOCUMENTS}; when the cap
     * is hit the response carries {@code truncated = true} so the caller can narrow the range.
     */
    public Map<String, Object> listDocumentsByDate(String from, String to) {
        Map<String, Object> result = new HashMap<>();
        try {
            LocalDate fromDate = LocalDate.parse(from);
            LocalDate toDate = LocalDate.parse(to);
            if (fromDate.isAfter(toDate)) {
                result.put("success", false);
                result.put("error", "From date must not be after To date");
                return result;
            }
            String where = " WHERE r_modify_date >= DATE('" + fromDate + "','yyyy-mm-dd')" +
                    " AND r_modify_date < DATE('" + toDate.plusDays(1) + "','yyyy-mm-dd')" +
                    " ORDER BY r_modify_date, r_object_id";
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            List<Map<String, Object>> documents = new ArrayList<>();
            boolean truncated = false;

            List<Map<String, Object>> notes = queryDocumentsPaged(baseUrl,
                    "SELECT r_object_id, object_name, r_modify_date FROM cms_note_document" + where,
                    "Notesheet", BULK_MAX_DOCUMENTS);
            documents.addAll(notes);
            truncated |= notes.size() >= BULK_MAX_DOCUMENTS;

            int remaining = BULK_MAX_DOCUMENTS - documents.size();
            if (remaining > 0) {
                List<Map<String, Object>> supporting = queryDocumentsPaged(baseUrl,
                        "SELECT r_object_id, object_name, r_modify_date, category FROM cms_supporting_document" + where,
                        null, remaining);
                documents.addAll(supporting);
                truncated |= supporting.size() >= remaining;
            } else {
                truncated = true;
            }

            result.put("success", true);
            result.put("documents", documents);
            result.put("truncated", truncated);
            return result;
        } catch (DateTimeParseException e) {
            result.put("success", false);
            result.put("error", "Dates must be in yyyy-mm-dd format");
            return result;
        } catch (Exception e) {
            log.error("Error listing documents between {} and {}: {}", from, to, e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to list documents: " + e.getMessage());
            return result;
        }
    }

    private List<Map<String, Object>> queryDocumentsPaged(String baseUrl, String dql, String fixedCategory, int limit) {
        List<Map<String, Object>> all = new ArrayList<>();
        for (int page = 1; all.size() < limit; page++) {
            List<Map<String, Object>> batch = queryDocuments(baseUrl, dql, fixedCategory, page, BULK_PAGE_SIZE);
            all.addAll(batch);
            if (batch.size() < BULK_PAGE_SIZE) {
                break;
            }
        }
        return all.size() > limit ? new ArrayList<>(all.subList(0, limit)) : all;
    }

    private List<Map<String, Object>> queryDocuments(String baseUrl, String dql, String fixedCategory) {
        return queryDocuments(baseUrl, dql, fixedCategory, 1, 200);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> queryDocuments(String baseUrl, String dql, String fixedCategory,
            int page, int pageSize) {
        Map<String, Object> response = restClient.get()
                .uri(baseUrl + "?dql={dql}&inline=true&page=" + page + "&items-per-page=" + pageSize, dql)
                .header("Authorization", authService.getUserAuthHeader())
                .header("Accept", "application/vnd.emc.documentum+json")
                .retrieve()
                .body(Map.class);

        List<Map<String, Object>> docs = new ArrayList<>();
        if (response == null || !(response.get("entries") instanceof List)) {
            return docs;
        }
        for (Map<String, Object> entry : (List<Map<String, Object>>) response.get("entries")) {
            Object content = entry.get("content");
            if (!(content instanceof Map) || !(((Map<String, Object>) content).get("properties") instanceof Map)) {
                continue;
            }
            Map<String, Object> props = (Map<String, Object>) ((Map<String, Object>) content).get("properties");
            Map<String, Object> doc = new HashMap<>();
            doc.put("id", props.get("r_object_id"));
            doc.put("name", props.get("object_name"));
            doc.put("modified", props.get("r_modify_date"));
            doc.put("category", fixedCategory != null ? fixedCategory : props.get("category"));
            docs.add(doc);
        }
        return docs;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> publishToIv(String docId) {
        Map<String, Object> result = new HashMap<>();

        if (ivConfig.getUrl() == null || ivConfig.getUrl().isBlank()) {
            result.put("success", false);
            result.put("error", "IV service is not configured for this environment");
            return result;
        }

        try {
            String url = ivConfig.getUrl() + "/processes/cms_call_publish_iv_service";
            Map<String, Object> payload = Map.of(
                    "run-stateless", "true",
                    "data", Map.of("variables", Map.of("doc_id", docId)));

            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", authService.getServiceAuthHeader())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .body(payload)
                    .retrieve()
                    .body(Map.class);

            String publicationId = null;
            if (response != null) {
                Object data = response.get("data");
                if (data instanceof Map) {
                    Object variables = ((Map<String, Object>) data).get("variables");
                    // The IV service returns variables as an array of objects; accept a plain object too.
                    if (variables instanceof List) {
                        for (Object item : (List<Object>) variables) {
                            if (item instanceof Map && ((Map<String, Object>) item).get("op_publicationId") != null) {
                                publicationId = String.valueOf(((Map<String, Object>) item).get("op_publicationId"));
                                break;
                            }
                        }
                    } else if (variables instanceof Map) {
                        Object opId = ((Map<String, Object>) variables).get("op_publicationId");
                        publicationId = opId != null ? String.valueOf(opId) : null;
                    }
                }
            }

            result.put("success", true);
            result.put("publicationId", publicationId);
            return result;
        } catch (Exception e) {
            log.error("Error publishing document {} to IV: {}", docId, e.getMessage());
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }
}
