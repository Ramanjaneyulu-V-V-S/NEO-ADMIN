package com.example.backend.controller;

import com.example.backend.config.DctmConfig;
import com.example.backend.dto.AuthResponse;
import com.example.backend.dto.LoginRequest;
import com.example.backend.service.AuthService;
import com.example.backend.service.DctmAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" }) // Allow frontend
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final DctmConfig dctmConfig;
    private final DctmAuthService dctmAuthService;
    private final RestClient restClient;
    private final Environment environment;

    public AuthController(AuthService authService,
                         DctmConfig dctmConfig,
                         DctmAuthService dctmAuthService,
                         RestClient.Builder restClientBuilder,
                         Environment environment) {
        this.authService = authService;
        this.dctmConfig = dctmConfig;
        this.dctmAuthService = dctmAuthService;
        this.restClient = restClientBuilder.build();
        this.environment = environment;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.authenticate(request);
        if (response.isAuthenticated()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(401).body(response);
        }
    }

    /**
     * Get user profile after OTDS authentication
     * Called after user authenticates via OTDS to fetch user details from Documentum
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile(
            @RequestParam String username,
            @RequestHeader(value = "Authorization", required = false) String bearerToken) {

        try {
            log.info("Fetching user profile for username: {} with OTDS token", username);

            // Validate that we have both username and OTDS token
            if (username == null || username.trim().isEmpty()) {
                return ResponseEntity.status(400).body(Map.of(
                    "error", "Missing username parameter"
                ));
            }

            if (bearerToken == null || bearerToken.trim().isEmpty()) {
                log.warn("No OTDS token provided for user: {}", username);
                return ResponseEntity.status(401).body(Map.of(
                    "error", "Missing authentication token",
                    "message", "OTDS token not provided"
                ));
            }

            // Use service account to fetch user details and resolve admin role
            AuthResponse response = authService.getUserProfile(username);

            if (response != null && response.isAuthenticated()) {
                log.info("Successfully fetched user profile for: {}", username);
                return ResponseEntity.ok(response.getUserDetails());
            } else {
                String errorMsg = response != null ? response.getMessage() : "Unknown error";
                log.warn("Failed to fetch user profile for '{}': {}", username, errorMsg);
                return ResponseEntity.status(401).body(Map.of(
                    "error", "User profile not found",
                    "message", errorMsg
                ));
            }
        } catch (Exception e) {
            log.error("Error fetching user profile for '{}': {}", username, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to fetch user profile",
                "message", e.getMessage(),
                "details", e.getClass().getSimpleName()
            ));
        }
    }

    /**
     * Get environment-specific configuration for login (OTDS endpoint and repository)
     * Frontend calls this to get the correct OTDS token API endpoint based on deployed environment
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getAuthConfig() {
        Map<String, String> config = new HashMap<>();
        String otdsTokenApiUrl = environment.getProperty("otds.token-api-url");
        String repository = dctmConfig.getRepository();
        String activeProfile = String.join(",", environment.getActiveProfiles());

        config.put("otdsTokenApiUrl", otdsTokenApiUrl);
        config.put("repository", repository);
        config.put("environment", activeProfile.isEmpty() ? "default" : activeProfile);

        log.info("Auth config requested - Profile: {}, Repository: {}, OTDS URL: {}",
                 activeProfile, repository, otdsTokenApiUrl);
        return ResponseEntity.ok(config);
    }

    /**
     * Get login ticket for current configured user using DQL
     */
    @GetMapping("/login-ticket")
    public ResponseEntity<Map<String, Object>> getLoginTicket() {
        return getLoginTicketForUser(null);
    }

    /**
     * Get login ticket for specified user using custom Documentum method
     * This allows support team to impersonate users for troubleshooting
     */
    @GetMapping("/login-ticket/{username}")
    public ResponseEntity<Map<String, Object>> getLoginTicketForUser(
            @PathVariable(required = false) String username) {

        Map<String, Object> result = new HashMap<>();

        try {
            // Determine target user
            String targetUser = (username == null || username.isEmpty())
                ? dctmConfig.getUsername()
                : username;

            log.info("Support team requesting login ticket for user: {}", targetUser);

            // Call custom Documentum method: generateUserLoginTicket
            // This method must be created by Documentum Administrator
            String methodDql = "EXECUTE generateUserLoginTicket WITH user_name='" +
                              targetUser.replace("'", "''") + "'";

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            // Use service account (SUPERUSER) to execute the method
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true", methodDql)
                    .header("Authorization", dctmAuthService.getUserAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("entries")) {
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> entries =
                    (java.util.List<Map<String, Object>>) response.get("entries");

                if (!entries.isEmpty()) {
                    Map<String, Object> entry = entries.get(0);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");

                    if (content != null && content.containsKey("properties")) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");

                        // The method returns the ticket as the result
                        String loginTicket = (String) props.get("result");

                        if (loginTicket != null && !loginTicket.isEmpty() &&
                            !loginTicket.startsWith("ERROR:")) {
                            result.put("success", true);
                            result.put("username", targetUser);
                            result.put("loginTicket", loginTicket);
                            result.put("message", "Login ticket generated successfully (valid for 10 minutes)");
                            result.put("expiresIn", "10 minutes");
                            log.info("Successfully generated login ticket for user: {}", targetUser);
                        } else {
                            result.put("success", false);
                            result.put("error", loginTicket != null ? loginTicket : "Failed to generate login ticket");
                        }
                    } else {
                        result.put("success", false);
                        result.put("error", "No result returned from method");
                    }
                } else {
                    result.put("success", false);
                    result.put("error", "Method execution returned no results");
                }
            } else {
                result.put("success", false);
                result.put("error", "Custom method 'generateUserLoginTicket' not found. Please contact Documentum Administrator to create this method.");
            }

        } catch (Exception e) {
            log.error("Error generating login ticket via custom method: {}", e.getMessage(), e);
            result.put("success", false);

            if (e.getMessage() != null && e.getMessage().contains("NOT_FOUND")) {
                result.put("error", "Custom method 'generateUserLoginTicket' not found in Documentum. Please contact administrator.");
            } else {
                result.put("error", "Failed to generate login ticket: " + e.getMessage());
            }

            return ResponseEntity.status(500).body(result);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Get current authenticated user info
     */
    @GetMapping("/current-user")
    public ResponseEntity<Map<String, Object>> getCurrentUser() {
        Map<String, Object> result = new HashMap<>();
        result.put("username", dctmConfig.getUsername());
        result.put("repository", dctmConfig.getRepository());
        result.put("serviceAccountConfigured", dctmAuthService.isServiceAccountConfigured());
        return ResponseEntity.ok(result);
    }

    /**
     * Get list of all users for dropdown selection
     * Support team can select which user to impersonate
     */
    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> getUsers() {
        Map<String, Object> result = new HashMap<>();

        try {
            // Query dm_user for all active users
            String dql = "SELECT user_name, user_address, user_privileges " +
                        "FROM dm_user " +
                        "WHERE user_state = 0 " + // 0 = active
                        "ORDER BY user_name " +
                        "ENABLE(RETURN_TOP 1000)";

            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true", dql)
                    .header("Authorization", dctmAuthService.getUserAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            java.util.List<Map<String, Object>> users = new java.util.ArrayList<>();

            if (response != null && response.containsKey("entries")) {
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> entries =
                    (java.util.List<Map<String, Object>>) response.get("entries");

                for (Map<String, Object> entry : entries) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> content = (Map<String, Object>) entry.get("content");

                    if (content != null && content.containsKey("properties")) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> props = (Map<String, Object>) content.get("properties");

                        Map<String, Object> user = new HashMap<>();
                        user.put("username", props.get("user_name"));
                        user.put("email", props.get("user_address"));
                        user.put("isSuperuser", (Integer)props.get("user_privileges") == 16);
                        users.add(user);
                    }
                }
            }

            result.put("success", true);
            result.put("users", users);
            result.put("count", users.size());

        } catch (Exception e) {
            log.error("Error fetching users: {}", e.getMessage());
            result.put("success", false);
            result.put("error", "Failed to fetch users: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }

        return ResponseEntity.ok(result);
    }
}
