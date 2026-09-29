package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import com.example.backend.config.AppConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class SfsService {

    private final DctmConfig dctmConfig;
    private final AppConfig appConfig;
    private final RestClient restClient;

    public SfsService(DctmConfig dctmConfig, AppConfig appConfig, RestClient.Builder restClientBuilder) {
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



    @SuppressWarnings("unchecked")
    public Map<String, Object> createDocumentType(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String folderId = appConfig.getSfs().getDocumentTypeFolderId();

        if (folderId == null || folderId.isBlank()) {
            throw new RuntimeException("SFS folder ID not configured. Please set app.sfs.document-type-folder-id in application.properties");
        }

        log.info("[SFS] Using configured folder ID: {}", folderId);

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type", "cms_sfs_metadata");
        props.put("document_type", request.get("document_type"));
        props.put("document_category", request.get("document_category"));
        props.put("serial_number", request.get("serial_number"));

        String createUrl = repoUrl + "/folders/" + folderId + "/objects";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[SFS] Creating document_type='{}' document_category='{}' serial_number='{}'",
                request.get("document_type"), request.get("document_category"), request.get("serial_number"));
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document type created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Document type creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDocumentTypes() {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String folderId = appConfig.getSfs().getDocumentTypeFolderId();

        if (folderId == null || folderId.isBlank()) {
            throw new RuntimeException("SFS folder ID not configured. Please set app.sfs.document-type-folder-id in application.properties");
        }

        try {
            // First, list objects in the folder to get their IDs
            String listUrl = repoUrl + "/folders/" + folderId + "/objects";
            Map<String, Object> listResponse = restClient.get()
                    .uri(listUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> result = new ArrayList<>();
            if (listResponse != null && listResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) listResponse.get("entries");

                // Fetch each object individually to get its full properties
                for (Map<String, Object> entry : entries) {
                    Object idObj = entry.get("r_object_id");
                    if (idObj == null) idObj = entry.get("id");

                    if (idObj != null) {
                        String objectId = idObj.toString();
                        // Extract ID from URL if needed
                        if (objectId.contains("/objects/")) {
                            objectId = objectId.substring(objectId.lastIndexOf("/objects/") + 9);
                        }

                        try {
                            String objectUrl = repoUrl + "/objects/" + objectId;
                            Map<String, Object> objectResponse = restClient.get()
                                    .uri(objectUrl)
                                    .header("Authorization", getAuthHeader())
                                    .header("Accept", "application/vnd.emc.documentum+json")
                                    .retrieve()
                                    .body(Map.class);

                            if (objectResponse != null) {
                                Map<String, Object> item = new HashMap<>();
                                item.put("r_object_id", objectId);

                                // Extract properties
                                if (objectResponse.containsKey("properties")) {
                                    Map<String, Object> props = (Map<String, Object>) objectResponse.get("properties");
                                    if (props != null) {
                                        item.putAll(props);
                                    }
                                }
                                result.add(item);
                            }
                        } catch (Exception e) {
                            log.warn("[SFS] Failed to fetch object {}: {}", objectId, e.getMessage());
                        }
                    }
                }
            }

            log.info("[SFS] Listed {} document types", result.size());
            return result;
        } catch (Exception e) {
            log.error("[SFS] Failed to list document types: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to list document types: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> updateDocumentType(String objectId, Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        Map<String, Object> props = new LinkedHashMap<>();
        if (request.containsKey("document_type")) props.put("document_type", request.get("document_type"));
        if (request.containsKey("document_category")) props.put("document_category", request.get("document_category"));
        if (request.containsKey("serial_number")) props.put("serial_number", request.get("serial_number"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        try {
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document type updated successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Update failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Update failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    public Map<String, Object> deleteDocumentType(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;

        try {
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document type deleted successfully");
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Delete failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Delete failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createDocumentCategory(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String folderId = appConfig.getSfs().getDocumentTypeFolderId();

        if (folderId == null || folderId.isBlank()) {
            throw new RuntimeException("SFS folder ID not configured. Please set app.sfs.document-type-folder-id in application.properties");
        }

        log.info("[SFS] Using configured folder ID: {}", folderId);

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type", "cms_sfs_metadata");
        props.put("document_type", request.get("document_type"));
        props.put("document_category", request.get("document_category"));
        props.put("serial_number", request.get("serial_number"));

        String createUrl = repoUrl + "/folders/" + folderId + "/objects";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        log.info("[SFS] Creating document category with document_type='{}' document_category='{}' serial_number='{}'",
                request.get("document_type"), request.get("document_category"), request.get("serial_number"));
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document category created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Document category creation failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDocumentCategories() {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        String folderId = appConfig.getSfs().getDocumentTypeFolderId();

        if (folderId == null || folderId.isBlank()) {
            throw new RuntimeException("SFS folder ID not configured. Please set app.sfs.document-type-folder-id in application.properties");
        }

        try {
            // First, list objects in the folder to get their IDs
            String listUrl = repoUrl + "/folders/" + folderId + "/objects";
            Map<String, Object> listResponse = restClient.get()
                    .uri(listUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> result = new ArrayList<>();
            if (listResponse != null && listResponse.containsKey("entries")) {
                List<Map<String, Object>> entries = (List<Map<String, Object>>) listResponse.get("entries");

                // Fetch each object individually to get its full properties
                for (Map<String, Object> entry : entries) {
                    Object idObj = entry.get("r_object_id");
                    if (idObj == null) idObj = entry.get("id");

                    if (idObj != null) {
                        String objectId = idObj.toString();
                        // Extract ID from URL if needed
                        if (objectId.contains("/objects/")) {
                            objectId = objectId.substring(objectId.lastIndexOf("/objects/") + 9);
                        }

                        try {
                            String objectUrl = repoUrl + "/objects/" + objectId;
                            Map<String, Object> objectResponse = restClient.get()
                                    .uri(objectUrl)
                                    .header("Authorization", getAuthHeader())
                                    .header("Accept", "application/vnd.emc.documentum+json")
                                    .retrieve()
                                    .body(Map.class);

                            if (objectResponse != null) {
                                Map<String, Object> item = new HashMap<>();
                                item.put("r_object_id", objectId);

                                // Extract properties
                                if (objectResponse.containsKey("properties")) {
                                    Map<String, Object> props = (Map<String, Object>) objectResponse.get("properties");
                                    if (props != null) {
                                        item.putAll(props);
                                    }
                                }
                                result.add(item);
                            }
                        } catch (Exception e) {
                            log.warn("[SFS] Failed to fetch object {}: {}", objectId, e.getMessage());
                        }
                    }
                }
            }

            log.info("[SFS] Listed {} document categories", result.size());
            return result;
        } catch (Exception e) {
            log.error("[SFS] Failed to list document categories: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to list document categories: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> updateDocumentCategory(String objectId, Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        Map<String, Object> props = new LinkedHashMap<>();
        if (request.containsKey("document_type")) props.put("document_type", request.get("document_type"));
        if (request.containsKey("document_category")) props.put("document_category", request.get("document_category"));
        if (request.containsKey("serial_number")) props.put("serial_number", request.get("serial_number"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);

        try {
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document category updated successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Update failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Update failed [" + e.getStatusCode() + "]: " + rb);
        }
    }

    public Map<String, Object> deleteDocumentCategory(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;

        try {
            restClient.delete()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .retrieve()
                    .toBodilessEntity();
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Document category deleted successfully");
            return result;
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[SFS] Delete failed [{}]: {}", e.getStatusCode(), rb);
            throw new RuntimeException("Delete failed [" + e.getStatusCode() + "]: " + rb);
        }
    }
}
