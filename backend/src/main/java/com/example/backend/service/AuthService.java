package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import com.example.backend.dto.AuthResponse;
import com.example.backend.dto.LoginRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final DctmConfig dctmConfig;
    private final RestClient.Builder restClientBuilder;
    private final GroupService groupService;

    public AuthResponse authenticate(LoginRequest request) {
        String repoName = (request.getRepository() != null && !request.getRepository().isEmpty())
                ? request.getRepository()
                : dctmConfig.getRepository();

        // Use credentials from request if provided, otherwise fallback to config
        // (service account)
        String username = request.getUsername();
        String password = request.getPassword();

        if (username == null || username.isBlank()) {
            // Logic for service account login if needed, though usually user logs in
            username = dctmConfig.getUsername();
            password = dctmConfig.getPassword();
        }

        String authHeader = "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));

        String url = dctmConfig.getUrl() + "/repositories/" + repoName + "/currentuser";

        log.info("Authenticating user '{}' against repository '{}'", username, repoName);

        try {
            RestClient restClient = restClientBuilder.build();
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restClient.get()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, authHeader)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);

            // Resolve admin role from group membership
            String adminRole = resolveAdminRole(username);
            if (result != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> properties = (Map<String, Object>) result.get("properties");
                if (properties != null) {
                    properties.put("admin_role", adminRole);
                } else {
                    // Documentum returned a flat structure — inject at top level
                    result.put("admin_role", adminRole);
                }
                log.info("Resolved admin role for user '{}': {}", username, adminRole);
            }

            return AuthResponse.success(username, repoName, result);

        } catch (HttpClientErrorException.Unauthorized e) {
            log.warn("Authentication failed for user '{}': Unauthorized", username);
            return AuthResponse.failure("Invalid credentials");
        } catch (HttpClientErrorException.Forbidden e) {
            log.warn("Authentication failed for user '{}': Forbidden", username);
            return AuthResponse.failure("Access denied");
        } catch (Exception e) {
            log.error("Error during authentication for user '{}'", username, e);
            return AuthResponse.failure("System error during authentication: " + e.getMessage());
        }
    }

    /**
     * Get user profile from Documentum using service account
     * Used after OTDS authentication to fetch full user details
     */
    public AuthResponse getUserProfile(String username) {
        String repoName = dctmConfig.getRepository();
        String serviceUsername = dctmConfig.getUsername();
        String servicePassword = dctmConfig.getPassword();

        log.info("Fetching user profile for '{}' (login_name)", username);
        log.info("Service account: {}, Repository: {}", serviceUsername, repoName);

        String authHeader = "Basic " + Base64.getEncoder().encodeToString(
                (serviceUsername + ":" + servicePassword).getBytes(StandardCharsets.UTF_8));

        try {
            RestClient restClient = restClientBuilder.build();

            // Use DQL to query user by login name — more reliable than direct endpoint
            String dql = "SELECT r_object_id, user_name, user_login_name, user_address, user_privileges, user_state " +
                        "FROM dm_user WHERE user_login_name = '" + username.replace("'", "''") + "'";

            String url = dctmConfig.getUrl() + "/repositories/" + repoName + "?dql={dql}&inline=true";

            log.info("Executing DQL query for user: {}", username);

            @SuppressWarnings("unchecked")
            Map<String, Object> dqlResponse = restClient.get()
                    .uri(url, dql)
                    .header(HttpHeaders.AUTHORIZATION, authHeader)
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (dqlResponse != null && dqlResponse.containsKey("entries")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> entries = (List<Map<String, Object>>) dqlResponse.get("entries");

                if (!entries.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> content = (Map<String, Object>) entries.get(0).get("content");

                    if (content != null && content.containsKey("properties")) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> properties = (Map<String, Object>) content.get("properties");

                        // Resolve admin role from group membership
                        String adminRole = resolveAdminRole(username);
                        properties.put("admin_role", adminRole);

                        log.info("Successfully fetched user profile for '{}' with admin role: {}", username, adminRole);
                        return AuthResponse.success(username, repoName, properties);
                    }
                }
            }

            log.warn("User '{}' not found in Documentum", username);
            return AuthResponse.failure("User not found: " + username);

        } catch (HttpClientErrorException.Unauthorized e) {
            log.error("Service account authentication failed. Check DCTM_SERVICE_USERNAME and DCTM_SERVICE_PASSWORD");
            return AuthResponse.failure("Service account authentication failed. Please check server configuration.");
        } catch (Exception e) {
            log.error("Error fetching user profile for '{}': {}", username, e.getMessage(), e);
            return AuthResponse.failure("Failed to fetch user profile: " + e.getMessage());
        }
    }

    private String resolveAdminRole(String username) {
        try {
            List<Map<String, String>> groups = groupService.getGroupsByUser(username);
            boolean isSuperAdmin = groups.stream()
                    .anyMatch(g -> "ecm_super_admin".equals(g.get("group_name")));
            if (isSuperAdmin) return "Super Admin";

            boolean isLocalAdmin = groups.stream()
                    .anyMatch(g -> "ecm_local_admin".equals(g.get("group_name")));
            if (isLocalAdmin) return "Local Admin";
        } catch (Exception e) {
            log.warn("Could not resolve admin role for user '{}': {}", username, e.getMessage());
        }
        return "Standard User";
    }
}
