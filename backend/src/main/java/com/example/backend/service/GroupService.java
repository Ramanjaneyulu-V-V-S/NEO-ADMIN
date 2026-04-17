package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class GroupService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;
    private final UserService userService;

    public GroupService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder, UserService userService) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
        this.userService = userService;
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Search groups using DCTM REST API /groups endpoint.
     * Returns paginated list of groups with their details.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchGroups(String groupName, int page, int itemsPerPage) {

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/groups";

        // Build URL with proper query parameters
        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        urlBuilder.append("?items-per-page=").append(itemsPerPage);
        urlBuilder.append("&page=").append(page);
        urlBuilder.append("&inline=true");

        // If group name filter is provided, add it as a filter parameter
        if (groupName != null && !groupName.isBlank()) {
            // Use proper filter syntax for DCTM REST API
            String filterValue = "group_name like '" + groupName.trim() + "%'";
            urlBuilder.append("&filter=").append(java.net.URLEncoder.encode(filterValue, StandardCharsets.UTF_8));
        }

        String fullUrl = urlBuilder.toString();
        log.info("Fetching groups from URL: {}", fullUrl);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(fullUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            log.info("Groups API response received with {} entries",
                response != null && response.containsKey("entries") ?
                ((List<?>) response.get("entries")).size() : 0);

            return transformResponse(response, page);

        } catch (Exception e) {
            log.error("Error fetching groups from REST API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch groups: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformResponse(Map<String, Object> response, int page) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("groups", new ArrayList<>());
            result.put("hasNext", false);
            result.put("page", page);
            return result;
        }

        result.put("page", response.get("page"));
        result.put("itemsPerPage", response.get("items-per-page"));

        // Check for next link
        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        // Transform entries
        List<Map<String, Object>> groups = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    List<Map<String, Object>> entryLinks = (List<Map<String, Object>>) content.get("links");

                    if (props != null) {
                        Map<String, Object> groupItem = new HashMap<>();
                        groupItem.put("r_object_id", props.get("r_object_id"));
                        groupItem.put("group_name", props.get("group_name"));
                        groupItem.put("description", props.get("description"));
                        groupItem.put("owner_name", props.get("owner_name"));
                        groupItem.put("users_names", props.get("users_names"));
                        groupItem.put("groups_names", props.get("groups_names"));
                        groupItem.put("r_creation_date", props.get("r_creation_date"));
                        groupItem.put("r_modify_date", props.get("r_modify_date"));

                        // Include available actions from links
                        if (entryLinks != null) {
                            Map<String, String> actions = new HashMap<>();
                            for (Map<String, Object> link : entryLinks) {
                                String rel = (String) link.get("rel");
                                String href = (String) link.get("href");
                                if (rel != null && href != null) {
                                    actions.put(rel, href);
                                }
                            }
                            groupItem.put("actions", actions);
                        }

                        groups.add(groupItem);
                    }
                }
            }
        }
        result.put("groups", groups);

        return result;
    }

    /**
     * Get detailed information about a specific group including all available actions/links
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getGroupDetails(String groupName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Fetching group details for: {}", groupName);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();

            if (response != null) {
                Map<String, Object> props = (Map<String, Object>) response.get("properties");
                List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");

                if (props != null) {
                    result.put("properties", props);
                }

                // Extract available actions from links
                if (links != null) {
                    Map<String, Map<String, String>> actions = new HashMap<>();
                    for (Map<String, Object> link : links) {
                        String rel = (String) link.get("rel");
                        String href = (String) link.get("href");
                        String method = (String) link.get("method"); // HTTP method (GET, POST, PUT, DELETE)

                        if (rel != null && href != null) {
                            Map<String, String> actionDetails = new HashMap<>();
                            actionDetails.put("href", href);
                            actionDetails.put("method", method != null ? method : "GET");
                            actions.put(rel, actionDetails);
                        }
                    }
                    result.put("availableActions", actions);

                    // Log available actions for debugging
                    log.info("Available actions for group '{}': {}", groupName, actions.keySet());
                }
            }

            return result;

        } catch (Exception e) {
            log.error("Error fetching group details for '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch group details: " + e.getMessage());
        }
    }

    /**
     * Get all members of a group
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getGroupMembers(String groupName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        log.info("Fetching members for group: {}", groupName);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();

            if (response != null) {
                Map<String, Object> props = (Map<String, Object>) response.get("properties");
                if (props != null) {
                    Object usersNames = props.get("users_names");
                    Object groupsNames = props.get("groups_names");

                    List<Map<String, String>> users = new ArrayList<>();
                    List<Map<String, String>> groups = new ArrayList<>();

                    // Process user members
                    if (usersNames instanceof List) {
                        for (Object name : (List<?>) usersNames) {
                            if (name != null && !name.toString().trim().isEmpty()) {
                                Map<String, String> user = new HashMap<>();
                                user.put("name", name.toString());
                                user.put("type", "user");
                                users.add(user);
                            }
                        }
                    } else if (usersNames != null && !usersNames.toString().trim().isEmpty()) {
                        Map<String, String> user = new HashMap<>();
                        user.put("name", usersNames.toString());
                        user.put("type", "user");
                        users.add(user);
                    }

                    // Process group members
                    if (groupsNames instanceof List) {
                        for (Object name : (List<?>) groupsNames) {
                            if (name != null && !name.toString().trim().isEmpty()) {
                                Map<String, String> group = new HashMap<>();
                                group.put("name", name.toString());
                                group.put("type", "group");
                                groups.add(group);
                            }
                        }
                    } else if (groupsNames != null && !groupsNames.toString().trim().isEmpty()) {
                        Map<String, String> group = new HashMap<>();
                        group.put("name", groupsNames.toString());
                        group.put("type", "group");
                        groups.add(group);
                    }

                    result.put("users", users);
                    result.put("groups", groups);
                    result.put("totalCount", users.size() + groups.size());
                }
            }

            return result;

        } catch (Exception e) {
            log.error("Error fetching members for group '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch group members: " + e.getMessage());
        }
    }

    /**
     * Resolve dm_user.user_name from a user_login_name via DQL.
     * DCTM REST /users/{name} and group membership require user_name, not user_login_name.
     */
    @SuppressWarnings("unchecked")
    private String resolveDmUserName(String userLoginName) {
        String safe = userLoginName.replace("'", "''");
        String dql  = "SELECT user_name, user_login_name FROM dm_user WHERE user_login_name = '" + safe + "'";
        String url  = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                    + "?dql={dql}&items-per-page=1&page=1&inline=true";
        try {
            Map<String, Object> response = restClient.get()
                    .uri(url, dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
            if (entries != null && !entries.isEmpty()) {
                Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        String userName = (String) props.get("user_name");
                        if (userName != null && !userName.isBlank()) {
                            log.info("Resolved user_login_name '{}' → dm_user.user_name '{}'", userLoginName, userName);
                            return userName;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not resolve dm_user.user_name for login_name '{}': {}", userLoginName, e.getMessage());
        }
        return userLoginName; // fallback
    }

    /**
     * Add a member to a group using DCTM REST API
     * The API expects a simple href reference to the user/group resource
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> addMember(String groupName, String memberName, String memberType, String memberSrc) {
        log.info("Adding {} '{}' to group '{}'", memberType, memberName, groupName);

        try {
            // Build the endpoint URL for adding to group
            String addUrl;
            String memberHref;

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            if ("user".equalsIgnoreCase(memberType)) {
                // DCTM /users/{name} requires dm_user.user_name, not user_login_name
                String dctmUserName = resolveDmUserName(memberName);
                addUrl = baseUrl + "/groups/" + groupName + "/users";
                String encodedName = java.net.URLEncoder.encode(dctmUserName, StandardCharsets.UTF_8).replace("+", "%20");
                memberHref = baseUrl + "/users/" + encodedName;
            } else {
                addUrl = baseUrl + "/groups/" + groupName + "/groups";
                memberHref = baseUrl + "/groups/" + memberName;
            }

            // The payload is simply an href reference to the member
            Map<String, Object> payload = new HashMap<>();
            payload.put("href", memberHref);

            log.info("Adding member via POST to: {}", addUrl);
            log.info("Payload: {}", payload);

            // Post the href reference to add the member
            restClient.post()
                    .uri(addUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", memberType + " '" + memberName + "' added successfully");

            log.info("Successfully added {} '{}' to group '{}'", memberType, memberName, groupName);
            return result;

        } catch (Exception e) {
            log.error("Error adding member '{}' to group '{}': {}", memberName, groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to add member: " + e.getMessage());
        }
    }

    /**
     * Remove a member from a group using ALTER GROUP ... DROP DML query.
     * Executes via DCTM REST API batch operations endpoint with elevated service account permissions.
     * For users in RO/TE department groups, also cleans up department_short_code_multi from the user profile.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> removeMember(String groupName, String memberName, String memberType) {
        log.info("Removing {} '{}' from group '{}'", memberType, memberName, groupName);

        try {
            // Build the ALTER GROUP ... DROP query
            String dmlQuery;
            if ("user".equalsIgnoreCase(memberType)) {
                // Resolve the DCTM username
                String dctmUserName = resolveDmUserName(memberName);
                // Execute: ALTER GROUP groupName DROP memberName
                dmlQuery = String.format("ALTER GROUP %s DROP %s", groupName, dctmUserName);
            } else {
                // Execute: ALTER GROUP groupName DROP memberName
                dmlQuery = String.format("ALTER GROUP %s DROP %s", groupName, memberName);
            }

            log.info("Executing ALTER GROUP query: {}", dmlQuery);

            // Execute via DCTM REST API batch endpoint with service account permissions
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/batch";

            // Prepare batch request body
            Map<String, Object> batchRequest = new HashMap<>();
            List<Map<String, String>> commands = new ArrayList<>();
            Map<String, String> command = new HashMap<>();
            command.put("command", dmlQuery);
            commands.add(command);
            batchRequest.put("commands", commands);

            log.debug("Sending batch request to: {}", baseUrl);

            restClient.post()
                    .uri(baseUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(batchRequest)
                    .retrieve()
                    .body(Map.class);

            log.debug("Batch command executed successfully");

            // For user removals from RO/TE department groups, clean up department code
            if ("user".equalsIgnoreCase(memberType)) {
                cleanupUserDepartmentAssignment(groupName, memberName);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", memberType + " '" + memberName + "' removed successfully");

            return result;

        } catch (Exception e) {
            log.error("Error removing member '{}' from group '{}': {}", memberName, groupName, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Failed to remove member: " + e.getMessage());
            return result;
        }
    }

    /**
     * Clean up department assignment when a user is removed from a department group.
     * Extracts department code from group name and removes it from user's department_short_code_multi.
     * Non-critical: failures are logged but don't abort the removal.
     */
    private void cleanupUserDepartmentAssignment(String groupName, String memberName) {
        try {
            String departmentCode = extractDepartmentCodeFromGroupName(groupName);
            if (departmentCode == null || departmentCode.isEmpty()) {
                log.debug("[Cleanup] Could not extract department code from group '{}'", groupName);
                return;
            }
            log.info("[Cleanup] Removing department code '{}' from user '{}' profile", departmentCode, memberName);
            userService.removeDepartmentCodeFromProfile(memberName, departmentCode);
        } catch (Exception e) {
            log.warn("[Cleanup] Failed to clean up department assignment for user '{}': {}", memberName, e.getMessage());
        }
    }

    /**
     * Extract department code from group name.
     * Examples:
     *   "ecm_tn_fad" → "fad"
     *   "ecm_ho_ddsi" → "ddsi"
     *   "ecm_maharashtra_rbme" → "rbme"
     */
    private String extractDepartmentCodeFromGroupName(String groupName) {
        if (groupName == null || groupName.isEmpty()) return null;

        // Group names follow pattern: ecm_<location>_<deptcode>
        // Split by underscore and get the last part
        String[] parts = groupName.split("_");
        if (parts.length >= 3) {
            // Join all parts after the second underscore (in case dept code has underscores)
            String code = String.join("_", java.util.Arrays.copyOfRange(parts, 2, parts.length));
            return code.toLowerCase();
        }
        return null;
    }

    /**
     * Search dm_groups by name prefix using DQL (avoids REST filter LIKE issues).
     * Returns a flat list of {group_name} maps.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, String>> searchGroupsByPrefix(String prefix, int maxResults) {
        String safe = prefix.replace("'", "''");
        String dql  = "SELECT group_name FROM dm_group WHERE group_name LIKE '" + safe + "%' ORDER BY group_name";
        String url  = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                    + "?dql={dql}&items-per-page={max}&page=1&inline=true";

        log.info("Searching groups by prefix '{}' via DQL", prefix);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(url, dql, maxResults)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> results = new ArrayList<>();
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
            if (entries != null) {
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        if (props != null) {
                            Map<String, String> item = new HashMap<>();
                            item.put("group_name", (String) props.get("group_name"));
                            results.add(item);
                        }
                    }
                }
            }
            return results;
        } catch (Exception e) {
            log.error("Error searching groups by prefix '{}': {}", prefix, e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Return all dm_groups the given user belongs to.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, String>> getGroupsByUser(String username) {
        // dm_group.users_names stores dm_user.user_name, not user_login_name — resolve first
        String resolved = resolveDmUserName(username);
        String safe   = resolved.replace("'", "''");
        String dql    = "SELECT group_name FROM dm_group WHERE ANY users_names = '" + safe + "' ORDER BY group_name";
        String url    = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                      + "?dql={dql}&items-per-page=200&page=1&inline=true";

        log.info("Fetching groups for user '{}'", username);
        try {
            Map<String, Object> response = restClient.get()
                    .uri(url, dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> results = new ArrayList<>();
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
            if (entries != null) {
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        if (props != null) {
                            Map<String, String> item = new HashMap<>();
                            item.put("group_name", (String) props.get("group_name"));
                            results.add(item);
                        }
                    }
                }
            }
            return results;
        } catch (Exception e) {
            log.error("Error fetching groups for user '{}': {}", username, e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Check whether a dm_group with the given name exists.
     */
    public Map<String, Object> checkGroupExists(String groupName) {
        try {
            Map<String, Object> details = getGroupDetails(groupName);
            boolean exists = details != null && details.containsKey("properties");
            Map<String, Object> result = new HashMap<>();
            result.put("exists", exists);
            if (exists) {
                result.put("properties", details.get("properties"));
            }
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("exists", false);
            return result;
        }
    }

    /**
     * Create a new dm_group with the given group_name and group_display_name
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createGroup(String groupName, String groupDisplayName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/groups";

        Map<String, Object> props = new HashMap<>();
        props.put("group_name", groupName);
        props.put("group_display_name", groupDisplayName);

        Map<String, Object> body = new HashMap<>();
        body.put("properties", props);

        log.info("Creating dm_group: group_name='{}', group_display_name='{}'", groupName, groupDisplayName);

        try {
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Vertical '" + groupName + "' created successfully");
            if (response != null) result.put("group", response);
            return result;

        } catch (Exception e) {
            log.error("Error creating group '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to create group: " + e.getMessage());
        }
    }

    /**
     * Create a dm_folder under /Cabinets/ECM CONFIG/Office Type/HO/<deptName>.
     * object_name = verticalFullName, title = verticalShortcode, subject = groupName.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createVerticalFolder(String verticalFullName, String verticalShortcode,
                                                     String groupName, String deptName) {
        // 1. Resolve parent folder by path via DQL
        String parentPath = "/ECM CONFIG/Office Type/HO/" + deptName;
        String safe = parentPath.replace("'", "''");
        String dql  = "SELECT r_object_id FROM dm_folder WHERE ANY r_folder_path = '" + safe + "'";
        String dqlUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "?dql={dql}&items-per-page=1&page=1&inline=true";

        log.info("[Folder] Resolving parent folder path: {}", parentPath);
        String parentId;
        try {
            Map<String, Object> dqlResp = restClient.get()
                    .uri(dqlUrl, dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, Object>> entries = dqlResp != null
                    ? (List<Map<String, Object>>) dqlResp.get("entries") : null;
            if (entries == null || entries.isEmpty()) {
                throw new RuntimeException("Parent folder not found for path: " + parentPath);
            }
            Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");
            Map<String, Object> props   = (Map<String, Object>) content.get("properties");
            parentId = (String) props.get("r_object_id");
            log.info("[Folder] Resolved parent folder id: {}", parentId);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to resolve parent folder: " + e.getMessage());
        }

        // 2. Create dm_folder under the resolved parent
        String folderUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + parentId + "/folders";

        Map<String, Object> folderProps = new HashMap<>();
        folderProps.put("object_name", verticalFullName);
        folderProps.put("title",       verticalShortcode);
        folderProps.put("subject",     groupName);

        Map<String, Object> body = Map.of("properties", folderProps);

        log.info("[Folder] Creating folder '{}' under parent {}", verticalFullName, parentId);
        try {
            restClient.post()
                    .uri(folderUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[Folder] Folder '{}' created successfully", verticalFullName);
            return Map.of("success", true, "message", "Folder created successfully");
        } catch (org.springframework.web.client.RestClientResponseException e) {
            String resp = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[Folder] Failed to create folder [{}]: {}", e.getStatusCode(), resp);
            throw new RuntimeException("Failed to create folder [" + e.getStatusCode() + "]: " + resp);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create folder: " + e.getMessage());
        }
    }

    /**
     * Update the group_display_name of a dm_group using PATCH.
     * Supports both PUT method and POST with X-HTTP-Method-Override header.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> updateGroupDisplayName(String groupName, String newDisplayName) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName;

        Map<String, Object> props = new HashMap<>();
        props.put("group_display_name", newDisplayName);
        Map<String, Object> body = new HashMap<>();
        body.put("properties", props);

        log.info("Updating group_display_name for '{}' to '{}'", groupName, newDisplayName);
        try {
            // Try PATCH via PUT first, then fallback to POST with override if needed
            try {
                Map<String, Object> response = restClient.put()
                        .uri(url)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/vnd.emc.documentum+json")
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                log.info("Successfully updated group_display_name for '{}' to '{}' via PUT", groupName, newDisplayName);
                return Map.of("success", true, "message", "Display name updated successfully", "properties",
                    response != null ? response.get("properties") : props);
            } catch (Exception putError) {
                log.warn("PUT request failed, trying POST with X-HTTP-Method-Override: {}", putError.getMessage());
                // Fallback to POST with X-HTTP-Method-Override for better compatibility
                Map<String, Object> response = restClient.post()
                        .uri(url)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/vnd.emc.documentum+json")
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .header("X-HTTP-Method-Override", "PATCH")
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                log.info("Successfully updated group_display_name for '{}' to '{}' via POST+PATCH", groupName, newDisplayName);
                return Map.of("success", true, "message", "Display name updated successfully", "properties",
                    response != null ? response.get("properties") : props);
            }
        } catch (Exception e) {
            log.error("Error updating display name for group '{}': {}", groupName, e.getMessage(), e);
            throw new RuntimeException("Failed to update display name: " + e.getMessage());
        }
    }

    /**
     * Search for users or groups to add as members using DQL
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> searchMembers(String query, String type) {
        String objectType = "user".equalsIgnoreCase(type) ? "dm_user" : "dm_group";
        String nameField = "user".equalsIgnoreCase(type) ? "user_name" : "group_name";

        // Build DQL query with LIKE clause for partial matching
        // Escape single quotes in query but use %% for SQL wildcard
        String escapedQuery = query.replace("'", "''");

        String dqlQuery;
        if ("user".equalsIgnoreCase(type)) {
            dqlQuery = "SELECT user_name, user_login_name, user_os_name FROM dm_user WHERE user_name LIKE '"
                + escapedQuery + "%' ORDER BY user_name";
        } else {
            dqlQuery = "SELECT group_name, description FROM dm_group WHERE group_name LIKE '"
                + escapedQuery + "%' ORDER BY group_name";
        }

        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Build URL using RestClient URI template to avoid encoding issues
        // The RestClient will handle proper encoding
        String url = baseUrl + "?dql={dql}&items-per-page=20&page=1&inline=true";

        log.info("Searching for {} with DQL: {}", type, dqlQuery);

        try {
            Map<String, Object> response = restClient.get()
                    .uri(url, dqlQuery)  // Use URI template with variable
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> results = new ArrayList<>();
            List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

            if (entries != null) {
                for (Map<String, Object> entry : entries) {
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");
                    if (content != null) {
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");
                        if (props != null) {
                            Map<String, String> item = new HashMap<>();
                            item.put("name", (String) props.get(nameField));
                            item.put("type", type);

                            // Capture the src link for adding members later
                            String src = (String) content.get("src");
                            if (src != null) {
                                item.put("src", src);
                            }

                            if ("user".equalsIgnoreCase(type)) {
                                String loginName = (String) props.get("user_login_name");
                                String osName = (String) props.get("user_os_name");
                                // Use login name or OS name as full name
                                item.put("fullName", loginName != null ? loginName : osName);
                            } else {
                                item.put("fullName", (String) props.get("description"));
                            }
                            results.add(item);
                        }
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("results", results);
            result.put("count", results.size());

            log.info("Found {} {}s matching '{}'", results.size(), type, query);
            return result;

        } catch (Exception e) {
            log.error("Error searching for {} with query '{}': {}", type, query, e.getMessage(), e);
            Map<String, Object> result = new HashMap<>();
            result.put("results", new ArrayList<>());
            result.put("count", 0);
            return result;
        }
    }
}
