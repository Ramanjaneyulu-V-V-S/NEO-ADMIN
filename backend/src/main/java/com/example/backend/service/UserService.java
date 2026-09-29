package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Slf4j
public class UserService {

    private final DctmConfig dctmConfig;
    private final OtdsService otdsService;
    private final EmailService emailService;
    private final RestClient restClient;
    private final ObjectProvider<GroupService> groupServiceProvider;

    public UserService(DctmConfig dctmConfig, OtdsService otdsService, EmailService emailService,
                       RestClient.Builder restClientBuilder, ObjectProvider<GroupService> groupServiceProvider) {
        this.dctmConfig = dctmConfig;
        this.otdsService = otdsService;
        this.emailService = emailService;
        this.restClient = restClientBuilder.build();
        this.groupServiceProvider = groupServiceProvider;
    }

    private String getAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /** Whitelist of DQL columns the User Directory may sort by (guards against injection via sortBy). */
    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "object_name",           "object_name",
            "uin",                   "uin",
            "user_grade",            "user_grade",
            "designation",           "designation",
            "department_short_code", "department_short_code",
            "ro_short_code",         "ro_short_code");

    /** Backwards-compatible overload (no extra filters / sort / total). */
    public Map<String, Object> searchUserProfiles(String query, int page, int itemsPerPage,
                                                    String officeTypeFilter, String locationFilter,
                                                    String deptNames) {
        return searchUserProfiles(query, page, itemsPerPage, officeTypeFilter, locationFilter, deptNames,
                null, null, null, null, null, null, false);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> searchUserProfiles(String query, int page, int itemsPerPage,
                                                    String officeTypeFilter, String locationFilter,
                                                    String deptNames,
                                                    String uin, String grade, String deptCode, String roCode,
                                                    String sortBy, String sortDir, boolean includeTotal) {
        StringBuilder dqlBuilder = new StringBuilder();
        dqlBuilder.append("SELECT r_object_id, object_name, uin, department_name, department_short_code, ro_short_code, user_grade, designation, ");
        dqlBuilder.append("user_email_address, user_login_name, primary_mobile_number, location, office_type, ");
        dqlBuilder.append("is_active, hindi_user_name, hindi_designation, user_role, department_short_code_multi ");
        dqlBuilder.append("FROM cms_user_profile WHERE object_name IS NOT NULL AND object_name != ' ' ");

        // Office type restriction — exact match for HO / RO / TE
        if ("HO".equalsIgnoreCase(officeTypeFilter)) {
            dqlBuilder.append("AND office_type = 'HO' ");
        } else if ("RO".equalsIgnoreCase(officeTypeFilter)) {
            dqlBuilder.append("AND office_type = 'RO' ");
        } else if ("TE".equalsIgnoreCase(officeTypeFilter)) {
            dqlBuilder.append("AND office_type = 'TE' ");
        }

        // Location filter (for RO/TE Local Admin)
        if (locationFilter != null && !locationFilter.isBlank()) {
            dqlBuilder.append("AND location = '").append(locationFilter.trim().replace("'", "''")).append("' ");
        }

        // Multi-department filter (for HO Local Admin) — filter by department_short_code_multi repeating attribute
        if (deptNames != null && !deptNames.isBlank()) {
            String[] names = deptNames.split(",");
            dqlBuilder.append("AND (");
            for (int i = 0; i < names.length; i++) {
                if (i > 0) dqlBuilder.append(" OR ");
                String shortCode = names[i].trim().toLowerCase().replace("'", "''");
                dqlBuilder.append("ANY department_short_code_multi = '").append(shortCode).append("'");
            }
            dqlBuilder.append(") ");
        }

        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim().replace("'", "''");
            dqlBuilder.append("AND (object_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR uin LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR user_login_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR department_name LIKE '%").append(q).append("%' ");
            dqlBuilder.append("OR designation LIKE '%").append(q).append("%') ");
        }

        // Dedicated UIN filter (User Directory)
        if (uin != null && !uin.isBlank()) {
            dqlBuilder.append("AND uin LIKE '%").append(uin.trim().replace("'", "''")).append("%' ");
        }
        // Grade filter (exact)
        if (grade != null && !grade.isBlank()) {
            dqlBuilder.append("AND user_grade = '").append(grade.trim().replace("'", "''")).append("' ");
        }
        // HO department filter (Super Admin) — repeating attribute
        if (deptCode != null && !deptCode.isBlank()) {
            dqlBuilder.append("AND ANY department_short_code_multi = '")
                      .append(deptCode.trim().toLowerCase().replace("'", "''")).append("' ");
        }
        // RO/TE location code filter (Super Admin)
        if (roCode != null && !roCode.isBlank()) {
            dqlBuilder.append("AND ro_short_code = '").append(roCode.trim().toLowerCase().replace("'", "''")).append("' ");
        }

        String sortCol = sortBy != null ? SORT_COLUMNS.getOrDefault(sortBy, "object_name") : "object_name";
        String dir = "desc".equalsIgnoreCase(sortDir) ? "DESC" : "ASC";
        dqlBuilder.append("ORDER BY ").append(sortCol).append(" ").append(dir);

        log.info("User profile search — officeType: {}, location: {}, deptNames: {}, sort: {} {}",
                officeTypeFilter, locationFilter, deptNames, sortCol, dir);

        return executeDql(dqlBuilder.toString(), page, itemsPerPage, includeTotal);
    }

    /**
     * Fetch user profiles for all members of a role group, independent of office
     * type filters. Supported roles: localAdmin (ecm_local_admin members) and
     * cgmSect (members of any ecm_*cgm_sec group across HO/RO/TE).
     */
    public Map<String, Object> getRoleMemberProfiles(String role, int page, int itemsPerPage) {
        String groupCondition;
        if ("localAdmin".equals(role)) {
            groupCondition = "group_name = 'ecm_local_admin'";
        } else if ("cgmSect".equals(role)) {
            groupCondition = "group_name LIKE 'ecm_%cgm_sec'";
        } else {
            throw new IllegalArgumentException("Unknown role: " + role);
        }

        String dql = "SELECT r_object_id, object_name, uin, department_name, department_short_code, "
                + "ro_short_code, designation, user_email_address, user_login_name, location, office_type "
                + "FROM cms_user_profile "
                + "WHERE object_name IN (SELECT users_names FROM dm_group WHERE " + groupCondition + ") "
                + "ORDER BY object_name";

        log.info("Role member profile export — role: {}", role);
        return executeDql(dql, page, itemsPerPage);
    }

    /**
     * Bulk fetch of the repeating department_short_code_multi attribute, keyed by r_object_id,
     * for every cms_user_profile matching the office-type filter. Used by the User Data Export
     * feature to expand multi-department users (e.g. CGMs/RO heads) into one export row per department.
     * officeTypeFilter: 'HO' → only HO users; 'RO' → non-HO users (RO/TE); null/blank → all.
     */
    @SuppressWarnings("unchecked")
    public Map<String, List<String>> getDeptMultiByOfficeType(String officeTypeFilter) {
        StringBuilder dqlBuilder = new StringBuilder();
        dqlBuilder.append("SELECT r_object_id, department_short_code_multi FROM cms_user_profile ");
        dqlBuilder.append("WHERE object_name IS NOT NULL AND object_name != ' ' ");
        if ("HO".equalsIgnoreCase(officeTypeFilter)) {
            dqlBuilder.append("AND office_type = 'HO' ");
        } else if ("RO".equalsIgnoreCase(officeTypeFilter)) {
            dqlBuilder.append("AND office_type != 'HO' ");
        }
        dqlBuilder.append("ORDER BY object_name");
        String dql = dqlBuilder.toString();

        Map<String, List<String>> result = new HashMap<>();
        int page = 1;
        while (true) {
            Map<String, Object> response = executeDql(dql, page, 2000);
            List<Map<String, Object>> users = (List<Map<String, Object>>) response.get("users");
            if (users == null || users.isEmpty()) break;
            for (Map<String, Object> u : users) {
                String objectId = (String) u.get("r_object_id");
                if (objectId == null) continue;
                List<String> codes = result.computeIfAbsent(objectId, k -> new ArrayList<>());
                Object raw = u.get("department_short_code_multi");
                if (raw instanceof List<?> list) {
                    for (Object v : list) {
                        if (v instanceof String s && !s.isBlank() && !codes.contains(s)) codes.add(s);
                    }
                } else if (raw instanceof String s && !s.isBlank() && !codes.contains(s)) {
                    codes.add(s);
                }
            }
            if (!Boolean.TRUE.equals(response.get("hasNext"))) break;
            page++;
        }
        return result;
    }

    /**
     * Check if a UIN already exists in cms_user_profile.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkUinExists(String uin) {
        String safe = uin.trim().replace("'", "''");
        String dql = "SELECT r_object_id, object_name FROM cms_user_profile WHERE uin = '" + safe + "'";
        log.info("Checking UIN existence: {}", uin);

        Map<String, Object> response = executeDql(dql, 1, 1);
        List<Map<String, Object>> users = (List<Map<String, Object>>) response.get("users");
        boolean exists = users != null && !users.isEmpty();

        Map<String, Object> result = new HashMap<>();
        result.put("exists", exists);
        if (exists) {
            result.put("userName", users.get(0).get("object_name"));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createUser(Map<String, Object> request) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/users";

        List<String> allowedFields = List.of(
            "user_name", "user_login_name", "user_address", "user_privileges",
            "user_source", "user_state", "user_os_name", "user_db_name",
            "user_password", "user_global_unique_id", "default_folder",
            "home_docbase", "acl_name", "description"
        );

        Map<String, Object> props = new HashMap<>();
        for (String field : allowedFields) {
            if (request.containsKey(field) && request.get(field) != null) {
                Object val = request.get(field);
                if (val instanceof String s && s.isBlank()) continue;
                props.put(field, val);
            }
        }



        Map<String, Object> body = new HashMap<>();
        body.put("properties", props);

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
            result.put("message", "User created successfully");
            if (response != null) {
                result.put("data", response);
            }

            // Automatically add the new user to dm_superusers_dynamic.
            // Documentum REST /users/{name} resolves by user_name (the object identifier),
            // not user_login_name — so pass user_name here.
            String userName = (String) props.get("user_name");
            if (userName != null && !userName.isBlank()) {
                addUserToGroup(userName, "dm_superusers_dynamic");

                // Add office-type-specific groups
                String officeType   = (String) request.get("profile_office_type");
                String roShortCode  = (String) request.get("profile_ro_short_code");
                if ("HO".equals(officeType)) {
                    String deptCode = (String) request.get("profile_department_short_code");
                    if (deptCode != null && !deptCode.isBlank()) {
                        addUserToGroup(userName, "ecm_ho_" + deptCode.toLowerCase());
                    }
                } else if ("RO".equals(officeType) || "TE".equals(officeType)) {
                    if (roShortCode != null && !roShortCode.isBlank()) {
                        String roGroup = "ecm_" + roShortCode.toLowerCase();
                        addUserToGroup(userName, roGroup);
                        @SuppressWarnings("unchecked")
                        List<String> deptCodes = (List<String>) request.get("profile_department_short_code_multi");
                        if (deptCodes != null) {
                            for (String deptCode : deptCodes) {
                                if (deptCode != null && !deptCode.isBlank()) {
                                    addUserToGroup(userName, roGroup + "_" + deptCode.toLowerCase());
                                }
                            }
                        }
                    }
                }
            }

            return result;
        } catch (RestClientResponseException e) {
            String body2 = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Error creating user [{}]: {}", e.getStatusCode(), body2);
            throw new RuntimeException("Failed to create user [" + e.getStatusCode() + "]: " + body2);
        } catch (Exception e) {
            log.error("Error creating user: {}", e.getMessage());
            throw new RuntimeException("Failed to create user: " + e.getMessage());
        }
    }

    /**
     * Adds a dm_user to a Documentum group via REST POST /groups/{groupName}/users
     * with body {"href": ".../users/{userName}"} — the format confirmed by probing the API.
     * userName must be the dm_user's user_name (object identifier), not user_login_name.
     * Logs a warning on failure but does not abort the parent operation.
     */
    private void addUserToGroup(String userName, String groupName) {
        log.info("[Group] Adding user '{}' to group '{}'", userName, groupName);
        String usersUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/groups/" + groupName + "/users";
        // Documentum REST URL lookup is case-sensitive — use user_name exactly as stored.
        String userHref = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/users/" + userName;
        Map<String, String> body = Map.of("href", userHref);
        try {
            restClient.post()
                    .uri(usersUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[Group] User '{}' successfully added to group '{}'", userName, groupName);
        } catch (RestClientResponseException e) {
            log.warn("[Group] Failed to add user '{}' to group '{}' [{}]: {}",
                    userName, groupName, e.getStatusCode(),
                    e.getResponseBodyAsString(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("[Group] Failed to add user '{}' to group '{}': {}", userName, groupName, e.getMessage());
        }
    }

    /**
     * Sets the password for an inline-password dm_user via Documentum REST API.
     * Must be called after the user has been created, as the creation body does not apply the password.
     */
    /**
     * Updates the password of an inline-password dm_user via DQL —
     * the same mechanism used for user_state updates, confirmed working.
     */
    /**
     * Updates the password of an inline-password dm_user.
     * Tries multiple Documentum REST approaches in order and logs the result of each.
     */
    public Map<String, Object> updateInlineUserPassword(String loginName, String newPassword, String adminUser) {
        String encoded = java.net.URLEncoder.encode(loginName, StandardCharsets.UTF_8).replace("+", "%20");
        String userUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/users/" + encoded;
        Map<String, Object> body = Map.of("properties", Map.of("user_password", newPassword));

        // Attempt 1: POST /users/{loginName} + X-Method-Override: PATCH
        log.info("[InlinePwd] Attempt POST+PATCH on /users/{}", loginName);
        try {
            restClient.post()
                    .uri(userUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[InlinePwd] POST+PATCH succeeded for: {}", loginName);
            boolean emailSent = sendPasswordEmail(loginName, newPassword, adminUser);
            return Map.of("success", true, "message", "Password updated successfully for user: " + loginName, "emailSent", emailSent);
        } catch (RestClientResponseException e1) {
            String r1 = e1.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.warn("[InlinePwd] POST+PATCH failed [{}]: {}", e1.getStatusCode(), r1);

            // Attempt 2: POST /users/{loginName} + X-Method-Override: PUT
            log.info("[InlinePwd] Attempt POST+PUT on /users/{}", loginName);
            try {
                restClient.post()
                        .uri(userUrl)
                        .header("Authorization", getAuthHeader())
                        .header("Content-Type", "application/vnd.emc.documentum+json")
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .header("X-Method-Override", "PUT")
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                log.info("[InlinePwd] POST+PUT succeeded for: {}", loginName);
                boolean emailSent = sendPasswordEmail(loginName, newPassword, adminUser);
                return Map.of("success", true, "message", "Password updated successfully for user: " + loginName, "emailSent", emailSent);
            } catch (RestClientResponseException e2) {
                String r2 = e2.getResponseBodyAsString(StandardCharsets.UTF_8);
                log.error("[InlinePwd] POST+PUT also failed [{}]: {}", e2.getStatusCode(), r2);
                throw new RuntimeException(
                        "Password update failed. POST+PATCH: [" + e1.getStatusCode() + "] " + r1
                        + " | POST+PUT: [" + e2.getStatusCode() + "] " + r2);
            }
        }
    }

    public Map<String, Object> updateUserPassword(String loginName, String newPassword, String adminUser) {
        // OTDS manages passwords for OTDS users — delegate to OtdsService
        otdsService.updateUserPassword(loginName, newPassword);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Password updated successfully for user: " + loginName);

        // Send email notification
        boolean emailSent = sendPasswordEmail(loginName, newPassword, adminUser);
        result.put("emailSent", emailSent);
        return result;
    }

    /**
     * Looks up the user's email (user_address) from dm_user and sends a password-reset notification.
     * Returns true if email was sent, false if skipped or failed.
     */
    @SuppressWarnings("unchecked")
    private boolean sendPasswordEmail(String loginName, String newPassword, String adminUser) {
        if (adminUser == null || adminUser.isBlank()) {
            log.warn("[Email] No adminUser provided — skipping password email for '{}'", loginName);
            return false;
        }
        try {
            String safe = loginName.replace("'", "''");
            String dql = "SELECT user_name, user_address FROM dm_user WHERE user_login_name = '" + safe + "'";
            Map<String, Object> result = executeDql(dql, 1, 1);
            List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("users");
            if (rows == null || rows.isEmpty()) {
                log.warn("[Email] No dm_user found for login '{}' — skipping email", loginName);
                return false;
            }
            String userName = (String) rows.get(0).get("user_name");
            String email = (String) rows.get(0).get("user_address");
            if (email == null || email.isBlank()) {
                log.warn("[Email] No email address for user '{}' — skipping email", loginName);
                return false;
            }
            return emailService.sendPasswordResetEmail(email, userName, newPassword, adminUser);
        } catch (Exception e) {
            log.error("[Email] Failed to send password email for '{}': {}", loginName, e.getMessage());
            return false;
        }
    }

    public Map<String, Object> searchDmUsers(String query, int page, int itemsPerPage, String officeTypeFilter) {
        StringBuilder dql = new StringBuilder();
        dql.append("SELECT user_name, user_login_name, user_address, user_source, ");
        dql.append("user_privileges, user_state, description ");
        dql.append("FROM dm_user WHERE user_login_name IS NOT NULL AND user_login_name != ' ' ");

        // Local Admin office type restriction via cms_user_profile subquery
        if ("HO".equalsIgnoreCase(officeTypeFilter)) {
            dql.append("AND user_name IN (SELECT object_name FROM cms_user_profile WHERE office_type = 'HO') ");
        } else if ("RO".equalsIgnoreCase(officeTypeFilter)) {
            dql.append("AND user_name IN (SELECT object_name FROM cms_user_profile WHERE office_type != 'HO') ");
        }

        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim();
            dql.append("AND (user_name LIKE '%").append(q).append("%' ");
            dql.append("OR user_login_name LIKE '%").append(q).append("%' ");
            dql.append("OR user_address LIKE '%").append(q).append("%') ");
        }
        dql.append("ORDER BY user_name");
        return executeDql(dql.toString(), page, itemsPerPage);
    }

    public Map<String, Object> updateDmUser(String loginName, Map<String, Object> properties) {
        String encoded = java.net.URLEncoder.encode(loginName, StandardCharsets.UTF_8).replace("+", "%20");
        String userUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/users/" + encoded;

        List<String> allowedFields = List.of(
            "user_name", "user_address", "user_privileges", "user_state",
            "description", "user_os_name", "user_db_name", "default_folder",
            "home_docbase", "acl_name"
        );

        Map<String, Object> props = new HashMap<>();
        for (String field : allowedFields) {
            if (properties.containsKey(field) && properties.get(field) != null
                    && !properties.get(field).toString().trim().isEmpty()) {
                props.put(field, properties.get(field));
            }
        }

        Map<String, Object> body = Map.of("properties", props);
        try {
            restClient.post()
                    .uri(userUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return Map.of("success", true, "message", "User updated successfully");
        } catch (RestClientResponseException e) {
            String respBody = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Error updating dm_user [{}]: {}", e.getStatusCode(), respBody);
            throw new RuntimeException("Failed to update user [" + e.getStatusCode() + "]: " + respBody);
        } catch (Exception e) {
            log.error("Error updating dm_user: {}", e.getMessage());
            throw new RuntimeException("Failed to update user: " + e.getMessage());
        }
    }

    public Map<String, Object> updateUserProfile(String objectId, Map<String, Object> properties) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/objects/" + objectId;

        // 1. Sync fields that mirror dm_user — fetch both names once if needed
        boolean needsSync = properties.containsKey("is_active") || properties.containsKey("user_email_address");
        String dmUserName   = null; // cms_user_profile.object_name  = dm_user.user_name  (for REST PATCH URL)
        String dmLoginName  = null; // cms_user_profile.user_login_name = dm_user.user_login_name (for OTDS)
        if (needsSync || properties.containsKey("department_name") || properties.containsKey("department_short_code_multi")) {
            Map<String, String> names = getNamesByProfileId(objectId);
            dmUserName  = names.get("object_name");
            dmLoginName = names.get("user_login_name");
        }

        // 1a. is_active → OTDS account enable/disable only
        if (properties.containsKey("is_active") && dmLoginName != null && !dmLoginName.isBlank()) {
            Object activeVal = properties.get("is_active");
            boolean isActive = (activeVal instanceof Boolean)
                    ? (Boolean) activeVal
                    : Boolean.parseBoolean(String.valueOf(activeVal));
            String otdsUserId = dmLoginName + "@DCTMPartitions";
            try {
                otdsService.setAccountDisabled(otdsUserId, !isActive);
                log.info("OTDS account {} for '{}'", isActive ? "enabled" : "disabled", otdsUserId);
            } catch (Exception otdsEx) {
                log.warn("OTDS sync failed for '{}': {}", otdsUserId, otdsEx.getMessage());
            }
        }

        // 1b. user_email_address → dm_user.user_address
        if (properties.containsKey("user_email_address") && dmUserName != null) {
            String email = (String) properties.get("user_email_address");
            log.info("Syncing dm_user.user_address for '{}': {}", dmUserName, email);
            patchDmUser(dmUserName, Map.of("user_address", email != null ? email : ""));
        }

        // 1c. Department change → remove department-related groups and clear vertical_ids
        if ((properties.containsKey("department_name") || properties.containsKey("department_short_code_multi")) && dmUserName != null && !dmUserName.isBlank()) {
            log.info("[DeptChange] Department changed for user '{}' — cleaning up groups and clearing vertical_ids", dmUserName);
            handleDepartmentChange(objectId, dmUserName, properties);
        }

        // 2. Prepare properties for cms_user_profile update
        Map<String, Object> body = new HashMap<>();
        Map<String, Object> props = new HashMap<>();

        List<String> allowedProps = List.of(
            "object_name", "uin", "department_name", "department_short_code",
            "ro_short_code", "user_grade", "grade_level", "designation",
            "user_email_address", "primary_mobile_number", "location", "office_type",
            "is_active", "hindi_user_name", "hindi_designation", "user_role"
        );

        for (String key : properties.keySet()) {
            if (allowedProps.contains(key)) {
                props.put(key, properties.get(key));
            }
        }
        // department_short_code_multi is a repeating attribute — handle separately
        Object multiRaw = properties.get("department_short_code_multi");
        if (multiRaw instanceof List<?> multiList && !multiList.isEmpty()) {
            props.put("department_short_code_multi", multiList);
        } else {
            String deptCode = (String) properties.get("department_short_code");
            if (deptCode != null && !deptCode.isBlank())
                props.put("department_short_code_multi", List.of(deptCode));
        }
        // Clear vertical_ids when department changes
        if (properties.containsKey("department_name") || properties.containsKey("department_short_code_multi")) {
            props.put("vertical_ids", new ArrayList<>()); // Clear vertical_ids
        }
        body.put("properties", props);

        try {
            return restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            log.error("Error updating user profile " + objectId, e);
            throw new RuntimeException("Failed to update user profile: " + e.getMessage());
        }
    }

    /**
     * Handle department change:
     * - HO users: Remove only groups for departments that were actually removed (smart cleanup)
     * - RO/TE users: Remove only department-related groups, ensure dm_superusers_dynamic exists
     */
    private void handleDepartmentChange(String objectId, String dmUserName, Map<String, Object> properties) {
        try {
            GroupService groupService = groupServiceProvider.getIfAvailable();
            if (groupService == null) {
                log.warn("[DeptChange] GroupService not available for department change cleanup");
                return;
            }

            // Get user's office type
            String officeType = getFieldFromProfile(objectId, "office_type");
            boolean isHO = "HO".equalsIgnoreCase(officeType);

            log.info("[DeptChange] User '{}' office_type: {} — {}", dmUserName, officeType, isHO ? "HO" : "RO/TE");

            // Get all groups the user belongs to
            List<Map<String, String>> allGroups = groupService.getGroupsByUser(dmUserName);
            log.info("[DeptChange] User '{}' is member of {} groups", dmUserName, allGroups.size());

            if (isHO) {
                // HO users: Smart cleanup — only remove groups for departments no longer selected
                // Extract new department codes from payload
                @SuppressWarnings("unchecked")
                List<String> newDeptCodes = (List<String>) properties.get("department_short_code_multi");
                if (newDeptCodes == null) {
                    String singleDept = (String) properties.get("department_short_code");
                    newDeptCodes = singleDept != null && !singleDept.isBlank()
                            ? List.of(singleDept)
                            : List.of();
                }

                // Convert new dept codes to lowercase for comparison
                List<String> newDeptCodesLower = newDeptCodes.stream()
                        .filter(d -> d != null && !d.isBlank())
                        .map(String::toLowerCase)
                        .toList();

                // Only remove groups for departments NOT in the new selection
                for (Map<String, String> group : allGroups) {
                    String groupName = group.get("group_name");
                    if (groupName != null && !groupName.equals("dm_superusers_dynamic")) {
                        // Extract department code from group name (e.g., ecm_ho_ddsi → ddsi)
                        String deptCode = extractDeptCodeFromHOGroup(groupName);

                        if (deptCode != null && !newDeptCodesLower.contains(deptCode)) {
                            try {
                                log.info("[DeptChange-HO] Removing user '{}' from group '{}' (dept no longer selected)", dmUserName, groupName);
                                groupService.removeMember(groupName, dmUserName, "user");
                            } catch (Exception e) {
                                log.warn("[DeptChange-HO] Failed to remove '{}' from group '{}': {}", dmUserName, groupName, e.getMessage());
                            }
                        }
                    }
                }
            } else {
                // RO/TE users: Remove only department-related groups
                String newDeptShortCode = getNewDepartmentShortCode(properties);
                if (newDeptShortCode != null && !newDeptShortCode.isEmpty()) {
                    String deptCodeLower = newDeptShortCode.toLowerCase();

                    for (Map<String, String> group : allGroups) {
                        String groupName = group.get("group_name");
                        // Remove groups containing the new department code (e.g., ecm_tn_ddsi_*)
                        if (groupName != null && groupName.contains("_" + deptCodeLower + "_") && !groupName.equals("dm_superusers_dynamic")) {
                            try {
                                log.info("[DeptChange-ROTE] Removing user '{}' from department group '{}'", dmUserName, groupName);
                                groupService.removeMember(groupName, dmUserName, "user");
                            } catch (Exception e) {
                                log.warn("[DeptChange-ROTE] Failed to remove '{}' from group '{}': {}", dmUserName, groupName, e.getMessage());
                            }
                        }
                    }

                    // Ensure dm_superusers_dynamic exists, add if missing
                    boolean hasSuperUsersGroup = allGroups.stream()
                            .anyMatch(g -> "dm_superusers_dynamic".equals(g.get("group_name")));

                    if (!hasSuperUsersGroup) {
                        try {
                            log.info("[DeptChange-ROTE] Adding user '{}' to dm_superusers_dynamic group", dmUserName);
                            groupService.addMember("dm_superusers_dynamic", dmUserName, "user", null);
                        } catch (Exception e) {
                            log.warn("[DeptChange-ROTE] Failed to add '{}' to dm_superusers_dynamic: {}", dmUserName, e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[DeptChange] Failed to handle department change groups for '{}': {}", dmUserName, e.getMessage());
        }
    }

    /**
     * Extract the new department short code from properties
     */
    private String getNewDepartmentShortCode(Map<String, Object> properties) {
        // Check department_short_code_multi (list)
        Object multiRaw = properties.get("department_short_code_multi");
        if (multiRaw instanceof List<?> multiList && !multiList.isEmpty()) {
            return (String) multiList.get(0);
        }
        // Fallback to department_short_code
        Object singleRaw = properties.get("department_short_code");
        if (singleRaw instanceof String) {
            return (String) singleRaw;
        }
        return null;
    }

    /**
     * Extract department code from HO group name.
     * Handles groups with suffixes like: ecm_ho_ddsi, ecm_ho_ddsi_bpe, ecm_ho_ddsi_dtv_grade_e
     * Returns only the department code part: "ddsi" in all cases
     */
    private String extractDeptCodeFromHOGroup(String groupName) {
        if (groupName == null || !groupName.startsWith("ecm_ho_")) {
            return null;
        }
        // Remove "ecm_ho_" prefix
        String afterPrefix = groupName.substring(7); // length of "ecm_ho_"
        if (afterPrefix.isEmpty()) {
            return null;
        }

        // Extract only the first segment (department code) before any underscore
        // e.g., "ddsi_bpe" → "ddsi", "ddsi" → "ddsi", "ddsi_dtv_grade_e" → "ddsi"
        int nextUnderscore = afterPrefix.indexOf('_');
        if (nextUnderscore > 0) {
            return afterPrefix.substring(0, nextUnderscore);
        }
        return afterPrefix;
    }

    /**
     * Get a specific field from user profile
     */
    @SuppressWarnings("unchecked")
    private String getFieldFromProfile(String objectId, String fieldName) {
        try {
            String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/objects/" + objectId;
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null) {
                Map<String, Object> props = (Map<String, Object>) response.get("properties");
                if (props != null) {
                    Object value = props.get(fieldName);
                    return value != null ? value.toString() : null;
                }
            }
        } catch (Exception e) {
            log.warn("[DeptChange] Failed to get field '{}' from profile {}: {}", fieldName, objectId, e.getMessage());
        }
        return null;
    }

    /**
     * Creates a cms_user_profile object in /UserProfile/UsersProfileBO and links it there.
     */
    public Map<String, Object> createCmsUserProfile(Map<String, Object> request) {
        String repoUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        // Step 1 — resolve folder r_object_id for /UserProfile/UsersProfileBO
        // r_folder_path is a repeating attribute — must use ANY keyword in DQL
        String folderDql = "SELECT r_object_id FROM dm_folder WHERE ANY r_folder_path = '/UserProfile/UsersProfileBO'";
        log.info("Resolving folder /UserProfile/UsersProfileBO");
        String folderId = resolveSingleObjectId(repoUrl, folderDql, "folder /UserProfile/UsersProfileBO");

        // Step 2 — build properties
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("r_object_type", "cms_user_profile");
        putIfPresent(props, request, "object_name");
        putIfPresent(props, request, "user_login_name");
        putIfPresent(props, request, "user_email_address");
        putIfPresent(props, request, "designation");
        putIfPresent(props, request, "hindi_designation");
        putIfPresent(props, request, "hindi_user_name");
        putIfPresent(props, request, "uin");
        putIfPresent(props, request, "location");
        putIfPresent(props, request, "office_type");
        putIfPresent(props, request, "ro_short_code");
        putIfPresent(props, request, "user_grade");
        putIfPresent(props, request, "department_name");
        putIfPresent(props, request, "department_short_code");
        if (request.get("grade_level") != null) props.put("grade_level", request.get("grade_level"));
        if (request.containsKey("is_active"))   props.put("is_active", request.get("is_active"));
        // department_short_code_multi is a repeating attribute
        // Frontend sends it as a List<String>; fall back to single department_short_code if absent
        Object multiRaw = request.get("department_short_code_multi");
        if (multiRaw instanceof List<?> multiList && !multiList.isEmpty()) {
            props.put("department_short_code_multi", multiList);
        } else {
            String deptCode = (String) request.get("department_short_code");
            if (deptCode != null && !deptCode.isBlank())
                props.put("department_short_code_multi", List.of(deptCode));
        }

        // Step 3 — POST to /folders/{folderId}/objects.
        // /folders/{id}/documents is restricted to dm_document subtypes only.
        // /folders/{id}/objects accepts any SysObject subtype including cms_user_profile.
        String createUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/folders/" + folderId + "/objects";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("properties", props);
        log.info("Creating cms_user_profile for '{}' in folder {} | hindi_user_name='{}' hindi_designation='{}'",
                request.get("user_login_name"), folderId,
                request.get("hindi_user_name"), request.get("hindi_designation"));
        try {
            Map<String, Object> response = restClient.post()
                    .uri(createUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json;charset=UTF-8")
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            log.info("cms_user_profile created for: {}", request.get("user_login_name"));
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "User profile created successfully");
            if (response != null) result.put("data", response);
            return result;
        } catch (RestClientResponseException e) {
            String respBody = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("Failed to create cms_user_profile [{}]: {}", e.getStatusCode(), respBody);
            throw new RuntimeException("Profile creation failed [" + e.getStatusCode() + "]: " + respBody);
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveSingleObjectId(String repoUrl, String dql, String label) {
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
                        if (p != null && p.get("r_object_id") != null)
                            return (String) p.get("r_object_id");
                    }
                }
            }
        } catch (RestClientResponseException e) {
            String rb = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new RuntimeException("Could not resolve " + label + " [" + e.getStatusCode() + "]: " + rb);
        }
        throw new RuntimeException("Could not find " + label + " — check the folder path exists in Documentum");
    }

    private void putIfPresent(Map<String, Object> target, Map<String, Object> source, String key) {
        Object val = source.get(key);
        if (val instanceof String s) { if (!s.isBlank()) target.put(key, s); }
        else if (val != null) target.put(key, val);
    }

    private void patchDmUser(String userName, Map<String, Object> props) {
        String encoded = java.net.URLEncoder.encode(userName, StandardCharsets.UTF_8).replace("+", "%20");
        String userUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository() + "/users/" + encoded;
        try {
            restClient.post()
                    .uri(userUrl)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(Map.of("properties", props))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to patch dm_user '{}' with {}: {}", userName, props.keySet(), e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> getNamesByProfileId(String profileId) {
        // object_name   = dm_user.user_name      (used for Documentum REST PATCH URL)
        // user_login_name = dm_user.user_login_name (used for OTDS: loginName@DCTMPartitions)
        String dql = "SELECT object_name, user_login_name FROM cms_user_profile WHERE r_object_id = '" + profileId + "'";
        Map<String, Object> response = executeDql(dql, 1, 1);
        List<Map<String, Object>> users = (List<Map<String, Object>>) response.get("users");
        if (users != null && !users.isEmpty()) {
            Map<String, Object> row = users.get(0);
            Map<String, String> result = new HashMap<>();
            result.put("object_name",     (String) row.get("object_name"));
            result.put("user_login_name", (String) row.get("user_login_name"));
            return result;
        }
        return Map.of();
    }

    /**
     * Fetch office_type and department_short_code_multi for a user from cms_user_profile by object_name.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getProfileByUsername(String username) {
        String safe = username.replace("'", "''");
        // DQL returns one row per repeating attribute value, so fetch up to 200 rows
        String dql  = "SELECT department_short_code_multi, office_type, location FROM cms_user_profile WHERE object_name = '" + safe + "'";
        Map<String, Object> result = executeDql(dql, 1, 200);
        List<?> rows = (List<?>) result.get("users");
        if (rows == null || rows.isEmpty()) return Map.of();

        // office_type and location are the same on every row — take from first row
        Map<String, Object> first = (Map<String, Object>) rows.get(0);
        String officeType = (String) first.get("office_type");
        String location   = (String) first.get("location");

        // Aggregate department_short_code_multi values.
        // Documentum REST may return them as:
        //   (a) a List<String> in a single row, OR
        //   (b) one String per row (one row per repeating value)
        List<String> deptCodes = new ArrayList<>();
        for (Object row : rows) {
            Object val = ((Map<String, Object>) row).get("department_short_code_multi");
            if (val instanceof List<?> list) {
                // Each row has a single-element list — collect from all rows
                for (Object item : list) {
                    if (item instanceof String s && !s.isBlank()) deptCodes.add(s);
                }
            } else if (val instanceof String s && !s.isBlank()) {
                deptCodes.add(s);
            }
        }

        log.info("Profile context for '{}': officeType={}, location={}, depts={}", username, officeType, location, deptCodes);
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("office_type", officeType);
        ctx.put("location", location);
        ctx.put("department_short_code_multi", deptCodes);
        return ctx;
    }

    /**
     * Fetch a single cms_user_profile by r_object_id directly from DCTM /objects/{id}.
     * Returns all properties including repeating attributes (e.g. department_short_code_multi) as arrays.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getProfileById(String objectId) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + objectId;
        try {
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);
            if (response != null && response.containsKey("properties")) {
                return (Map<String, Object>) response.get("properties");
            }
            return Map.of();
        } catch (Exception e) {
            log.error("Error fetching profile {}: {}", objectId, e.getMessage());
            throw new RuntimeException("Failed to fetch profile: " + e.getMessage());
        }
    }

    /**
     * Fetch cms_user_profile objects for a given HO department short code.
     * department_short_code_multi is a repeating attribute → use ANY keyword.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUsersByDeptShortCode(String shortCode) {
        return getUsersByDeptShortCode(shortCode, null);
    }

    public List<Map<String, Object>> getUsersByDeptShortCode(String shortCode, String officeType) {
        String safe = shortCode.replace("'", "''");
        String dql  = "SELECT r_object_id, object_name, user_login_name, office_type, department_short_code, department_short_code_multi FROM cms_user_profile"
                    + " WHERE object_name IS NOT NULL AND object_name != ' ' AND ANY department_short_code_multi = '" + safe + "'";

        // Filter by office type if provided
        if (officeType != null && !officeType.isBlank()) {
            String safeOfficeType = officeType.replace("'", "''");
            dql += " AND office_type = '" + safeOfficeType + "'";
        }

        dql += " ORDER BY object_name";

        Map<String, Object> result = executeDql(dql, 1, 500);
        List<?> raw = (List<?>) result.get("users");
        if (raw == null) return Collections.emptyList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object o : raw) {
            if (o instanceof Map<?,?> m) {
                Map<String, Object> user = (Map<String, Object>) m;
                // Additional safety: ensure office_type matches filter if provided
                if (officeType != null && !officeType.isBlank()) {
                    String userOfficeType = (String) user.get("office_type");
                    if (!officeType.equalsIgnoreCase(userOfficeType)) {
                        continue; // Skip if office type doesn't match
                    }
                }
                list.add(user);
            }
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUsersByLocation(String location) {
        return getUsersByLocation(location, null);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUsersByLocation(String location, String officeType) {
        String safe = location.replace("'", "''");
        String dql  = "SELECT r_object_id, object_name, user_login_name, department_short_code_multi, office_type FROM cms_user_profile"
                    + " WHERE object_name IS NOT NULL AND object_name != ' ' AND location = '" + safe + "'";

        // Filter by office type if provided (RO or TE)
        if (officeType != null && !officeType.isBlank()) {
            String safeOfficeType = officeType.replace("'", "''");
            dql += " AND office_type = '" + safeOfficeType + "'";
        }

        dql += " ORDER BY object_name";

        Map<String, Object> result = executeDql(dql, 1, 500);
        List<?> raw = (List<?>) result.get("users");
        if (raw == null) return Collections.emptyList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Object o : raw) {
            if (o instanceof Map<?,?> m) {
                Map<String, Object> user = (Map<String, Object>) m;
                // Additional safety: ensure office_type matches filter if provided
                if (officeType != null && !officeType.isBlank()) {
                    String userOfficeType = (String) user.get("office_type");
                    if (!officeType.equalsIgnoreCase(userOfficeType)) {
                        continue; // Skip if office type doesn't match
                    }
                }
                list.add(user);
            }
        }
        return list;
    }

    /**
     * Adds a vertical folder's r_object_id to the vertical_ids repeating attribute
     * on a cms_user_profile. Steps:
     *  1. Fetch r_object_id from dm_folder WHERE subject = verticalGroupName
     *  2. Fetch current vertical_ids from the profile
     *  3. PATCH the profile with the appended list
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> addVerticalIdToProfile(String profileObjectId, String verticalGroupName) {
        // Step 1: Resolve folder ID by subject
        String safe = verticalGroupName.replace("'", "''");
        String dql  = "SELECT r_object_id FROM dm_folder WHERE subject = '" + safe + "'";
        Map<String, Object> dqlResult = executeDql(dql, 1, 1);
        List<?> entries = (List<?>) dqlResult.get("users");
        if (entries == null || entries.isEmpty()) {
            throw new RuntimeException("No folder found with subject: " + verticalGroupName);
        }
        Map<String, Object> folderProps = (Map<String, Object>) entries.get(0);
        String folderId = (String) folderProps.get("r_object_id");

        // Step 2: Fetch current vertical_ids
        Map<String, Object> profile = getProfileById(profileObjectId);
        List<String> currentIds = new ArrayList<>();
        Object existing = profile.get("vertical_ids");
        if (existing instanceof List<?> existingList) {
            for (Object id : existingList) { if (id instanceof String s) currentIds.add(s); }
        }
        if (currentIds.contains(folderId)) {
            return Map.of("success", true, "message", "Vertical ID already present in profile");
        }

        // Step 3: PATCH profile with appended vertical_ids
        currentIds.add(folderId);
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + profileObjectId;
        Map<String, Object> body = Map.of("properties", Map.of("vertical_ids", currentIds));
        try {
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return Map.of("success", true, "message", "Vertical ID added to profile");
        } catch (org.springframework.web.client.RestClientResponseException e) {
            String resp = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[VerticalId] Failed to update profile [{}]: {}", e.getStatusCode(), resp);
            throw new RuntimeException("Failed to update vertical_ids [" + e.getStatusCode() + "]: " + resp);
        }
    }

    /**
     * Removes a vertical folder's r_object_id from the vertical_ids repeating attribute
     * on a cms_user_profile identified by user_login_name. Steps:
     *  1. Fetch r_object_id from dm_folder WHERE subject = verticalGroupName
     *  2. DQL to find cms_user_profile r_object_id WHERE user_login_name = userLoginName
     *  3. Fetch current vertical_ids from the profile
     *  4. Remove the folder ID and PATCH
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> removeVerticalIdFromProfile(String userLoginName, String verticalGroupName) {
        // Step 1: Resolve folder ID by subject
        String safeName = verticalGroupName.replace("'", "''");
        String folderDql = "SELECT r_object_id FROM dm_folder WHERE subject = '" + safeName + "'";
        Map<String, Object> folderResult = executeDql(folderDql, 1, 1);
        List<?> folderEntries = (List<?>) folderResult.get("users");
        if (folderEntries == null || folderEntries.isEmpty()) {
            log.warn("[VerticalId] No folder found with subject '{}', skipping remove", verticalGroupName);
            return Map.of("success", true, "message", "No folder found, nothing to remove");
        }
        String folderId = (String) ((Map<String, Object>) folderEntries.get(0)).get("r_object_id");

        // Step 2: Find cms_user_profile by object_name (dm_group stores dm_user.user_name, which matches object_name in cms_user_profile)
        String safeLogin = userLoginName.replace("'", "''");
        String profileDql = "SELECT r_object_id FROM cms_user_profile WHERE object_name = '" + safeLogin + "'";
        Map<String, Object> profileResult = executeDql(profileDql, 1, 1);
        List<?> profileEntries = (List<?>) profileResult.get("users");
        if (profileEntries == null || profileEntries.isEmpty()) {
            log.warn("[VerticalId] No profile found for user_login_name '{}', skipping remove", userLoginName);
            return Map.of("success", true, "message", "No profile found, nothing to remove");
        }
        String profileObjectId = (String) ((Map<String, Object>) profileEntries.get(0)).get("r_object_id");

        // Step 3: Fetch current vertical_ids
        Map<String, Object> profile = getProfileById(profileObjectId);
        List<String> currentIds = new ArrayList<>();
        Object existing = profile.get("vertical_ids");
        if (existing instanceof List<?> existingList) {
            for (Object id : existingList) { if (id instanceof String s) currentIds.add(s); }
        }
        if (!currentIds.contains(folderId)) {
            return Map.of("success", true, "message", "Vertical ID not present in profile");
        }

        // Step 4: Remove and PATCH
        currentIds.remove(folderId);
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                + "/objects/" + profileObjectId;
        Map<String, Object> body = Map.of("properties", Map.of("vertical_ids", currentIds));
        try {
            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("[VerticalId] Removed folder '{}' from profile of '{}'", folderId, userLoginName);
            return Map.of("success", true, "message", "Vertical ID removed from profile");
        } catch (org.springframework.web.client.RestClientResponseException e) {
            String resp = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            log.error("[VerticalId] Failed to remove vertical_id [{}]: {}", e.getStatusCode(), resp);
            throw new RuntimeException("Failed to update vertical_ids [" + e.getStatusCode() + "]: " + resp);
        }
    }

    private void executeDqlUpdate(String dql) {
         String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
         try {
             // Sending DQL update via GET (standard simplified REST DQL execution)
             restClient.get()
                .uri(url + "?dql={dql}", dql)
                .header("Authorization", getAuthHeader())
                .retrieve()
                .toBodilessEntity();
         } catch (Exception e) {
             log.error("Error executing DQL update: " + dql, e);
             // We continue even if this fails, though ideally we should handle it
         }
    }

    private Map<String, Object> executeDql(String dql, int page, int itemsPerPage) {
        return executeDql(dql, page, itemsPerPage, false);
    }

    private Map<String, Object> executeDql(String dql, int page, int itemsPerPage, boolean includeTotal) {
        String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();
        try {
            String uriTemplate = url + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true"
                    + (includeTotal ? "&include-total=true" : "");
            Map<String, Object> response = restClient.get()
                    .uri(uriTemplate, dql, itemsPerPage, page)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            return transformResponse(response, page, itemsPerPage);
        } catch (Exception e) {
            log.error("Error executing DQL", e);
            throw new RuntimeException("DQL execution failed: " + e.getMessage());
        }
    }

    /**
     * Remove a specific department code from the user profile's department_short_code_multi repeating attribute.
     * If the code doesn't exist, this silently succeeds (no error).
     */
    @SuppressWarnings("unchecked")
    public void removeDepartmentCodeFromProfile(String userLoginName, String departmentCode) {
        try {
            // Step 1: Find cms_user_profile by object_name
            String safeLogin = userLoginName.replace("'", "''");
            String profileDql = "SELECT r_object_id FROM cms_user_profile WHERE object_name = '" + safeLogin + "'";
            Map<String, Object> profileResult = executeDql(profileDql, 1, 1);
            List<?> profileEntries = (List<?>) profileResult.get("users");
            if (profileEntries == null || profileEntries.isEmpty()) {
                log.warn("[DeptCode] No profile found for user '{}', skipping cleanup", userLoginName);
                return;
            }
            String profileObjectId = (String) ((Map<String, Object>) profileEntries.get(0)).get("r_object_id");

            // Step 2: Fetch current profile and get department_short_code_multi
            Map<String, Object> profile = getProfileById(profileObjectId);
            List<String> currentCodes = new ArrayList<>();
            Object existing = profile.get("department_short_code_multi");
            if (existing instanceof List<?> existingList) {
                for (Object code : existingList) {
                    if (code instanceof String s && !s.isBlank()) currentCodes.add(s);
                }
            }

            // Step 3: If department code is not in the list, no action needed
            String safeDeptCode = departmentCode.trim();
            if (!currentCodes.contains(safeDeptCode)) {
                log.debug("[DeptCode] Department code '{}' not found in profile of '{}', nothing to remove",
                         departmentCode, userLoginName);
                return;
            }

            // Step 4: Remove code and PATCH
            currentCodes.remove(safeDeptCode);
            String url = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository()
                    + "/objects/" + profileObjectId;
            Map<String, Object> body = Map.of("properties", Map.of("department_short_code_multi", currentCodes));

            restClient.post()
                    .uri(url)
                    .header("Authorization", getAuthHeader())
                    .header("Content-Type", "application/vnd.emc.documentum+json")
                    .header("Accept",        "application/vnd.emc.documentum+json")
                    .header("X-Method-Override", "PATCH")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("[DeptCode] Removed department code '{}' from profile of '{}'", departmentCode, userLoginName);
        } catch (Exception e) {
            log.warn("[DeptCode] Failed to remove department code '{}' from profile of '{}': {}",
                    departmentCode, userLoginName, e.getMessage());
            // Non-critical: don't throw, just log and continue
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> transformResponse(Map<String, Object> response, int page, int itemsPerPage) {
        Map<String, Object> result = new HashMap<>();
        if (response == null) {
            result.put("users", new ArrayList<>());
            result.put("total", 0);
            return result;
        }

        List<Map<String, Object>> users = new ArrayList<>();
        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");

        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        users.add(props);
                    }
                }
            }
        }

        result.put("users", users);
        result.put("page", page);
        result.put("itemsPerPage", itemsPerPage);

        // total is present only when the DQL feed was requested with include-total=true
        Object total = response.get("total");
        if (total != null) {
            result.put("total", total);
        }

        List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
        boolean hasNext = false;
        if (links != null) {
            hasNext = links.stream().anyMatch(link -> "next".equals(link.get("rel")));
        }
        result.put("hasNext", hasNext);

        return result;
    }
}
