package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.function.Function;

@Service
@Slf4j
public class DctmAuthService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    // Cache for service account login ticket
    private String serviceLoginTicket;
    private LocalDateTime serviceTicketExpiry;

    public DctmAuthService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
        this.dctmConfig = dctmConfig;
        this.restClient = restClientBuilder.build();
    }

    /**
     * Get Basic Auth header for regular user operations
     */
    public String getUserAuthHeader() {
        String username = dctmConfig.getUsername();
        String password = dctmConfig.getPassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Get auth header for privileged operations using service account
     * Uses login ticket for better performance
     */
    public String getServiceAuthHeader() {
        // If service account not configured, fall back to regular user
        if (dctmConfig.getServiceUsername() == null ||
            dctmConfig.getServiceUsername().isEmpty()) {
            log.warn("Service account not configured, using regular user credentials");
            return getUserAuthHeader();
        }

        String ticket = getServiceLoginTicket();
        // The ticket lookup falls back to a complete "Basic ..." header when login-tickets is unavailable
        return ticket.startsWith("Basic ") ? ticket : "DmTicket " + ticket;
    }

    /**
     * Get Basic Auth header for service account (used to obtain login ticket)
     */
    private String getServiceBasicAuthHeader() {
        String username = dctmConfig.getServiceUsername();
        String password = dctmConfig.getServicePassword();
        return "Basic " + Base64.getEncoder().encodeToString(
                (username + ":" + password).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Get login ticket for privileged service account
     * Tickets are cached and reused until expiry
     */
    private String getServiceLoginTicket() {
        // Return cached ticket if still valid
        if (serviceLoginTicket != null &&
                serviceTicketExpiry != null &&
                LocalDateTime.now().isBefore(serviceTicketExpiry)) {
            return serviceLoginTicket;
        }

        // Get new login ticket
        String url = dctmConfig.getUrl() + "/repositories/" +
                dctmConfig.getRepository() + "/login-tickets";

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri(url)
                    .header("Authorization", getServiceBasicAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            if (response != null && response.containsKey("id")) {
                serviceLoginTicket = (String) response.get("id");
                // Cache ticket for 9 minutes (they typically expire in 10 minutes)
                serviceTicketExpiry = LocalDateTime.now().plusMinutes(9);
                log.info("Obtained service account login ticket (expires at {})", serviceTicketExpiry);
                return serviceLoginTicket;
            }
        } catch (Exception e) {
            log.error("Failed to obtain service account login ticket: {}", e.getMessage());
            // Fall back to basic auth
            return getServiceBasicAuthHeader();
        }

        throw new RuntimeException("Failed to obtain service account login ticket");
    }

    /**
     * Execute a privileged operation using service account
     * Logs the actual user for audit purposes
     *
     * @param actualUser The user requesting the operation
     * @param operation The operation to execute
     * @return Result of the operation
     */
    public <T> T executeAsService(String actualUser, Function<String, T> operation) {
        log.info("Executing privileged operation for user: {} using service account", actualUser);
        String authHeader = getServiceAuthHeader();
        return operation.apply(authHeader);
    }

    /**
     * Clear cached login ticket (useful for testing or forced refresh)
     */
    public void clearServiceTicketCache() {
        serviceLoginTicket = null;
        serviceTicketExpiry = null;
        log.info("Service account login ticket cache cleared");
    }

    /**
     * Check if service account is configured
     */
    public boolean isServiceAccountConfigured() {
        return dctmConfig.getServiceUsername() != null &&
                !dctmConfig.getServiceUsername().isEmpty();
    }
}
