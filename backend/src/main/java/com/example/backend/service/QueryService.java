package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@Slf4j
public class QueryService {

    /** Only these leading verbs may run from the Query tab — it is a read-only console. */
    private static final Set<String> READ_ONLY_VERBS = Set.of("SELECT");

    /** {@code -- line} comments and {@code /* block *}{@code /} comments, stripped before the verb check. */
    private static final Pattern COMMENTS =
            Pattern.compile("--[^\\n]*|/\\*.*?\\*/", Pattern.DOTALL);

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public QueryService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
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
     * Execute a DQL query and return results.
     * Automatically adds r_object_id and r_object_type to the SELECT if not present.
     * Uses DQL ENABLE(RETURN_TOP n) hint to limit results at database level.
     *
     * @param dqlQuery The DQL query to execute
     * @param limit Maximum number of results to return (uses DQL hint)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> executeQuery(String dqlQuery, int limit) {
        if (dqlQuery == null || dqlQuery.isBlank()) {
            return errorResult("Query cannot be empty");
        }

        // The Query tab is a read-only console: reject anything that isn't a single
        // SELECT before it can reach Documentum.
        String guardError = validateReadOnly(dqlQuery);
        if (guardError != null) {
            log.warn("Blocked non-SELECT DQL from Query tab: {}", firstChars(dqlQuery, 200));
            return errorResult(guardError);
        }

        // Modify query to include r_object_id and r_object_type if not present
        String modifiedQuery = ensureRequiredColumns(dqlQuery.trim());

        // Extract user's RETURN_TOP limit if present
        int effectiveLimit = extractReturnTopLimit(modifiedQuery, limit);

        // Add DQL ENABLE(RETURN_TOP n) hint to limit results at database level
        modifiedQuery = addReturnTopHint(modifiedQuery, effectiveLimit);

        // Build URL
        String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

        log.info("Executing DQL query with limit {}: {}", effectiveLimit, modifiedQuery);

        try {
            List<Map<String, Object>> allRows = new ArrayList<>();
            List<String> columns = new ArrayList<>();
            int page = 1;
            int itemsPerPage = Math.min(100, effectiveLimit); // Fetch in batches
            boolean hasMore = true;
            int maxPages = (int) Math.ceil((double) effectiveLimit / itemsPerPage);

            while (hasMore && page <= maxPages && allRows.size() < effectiveLimit) {
                Map<String, Object> response = restClient.get()
                        .uri(baseUrl + "?dql={dql}&items-per-page={itemsPerPage}&page={page}&inline=true",
                                modifiedQuery, itemsPerPage, page)
                        .header("Authorization", getAuthHeader())
                        .header("Accept", "application/vnd.emc.documentum+json")
                        .retrieve()
                        .body(Map.class);

                Map<String, Object> pageResult = transformPageResponse(response, columns);
                List<Map<String, Object>> pageRows = (List<Map<String, Object>>) pageResult.get("rows");
                allRows.addAll(pageRows);

                // Check if there's a next page
                List<Map<String, Object>> links = (List<Map<String, Object>>) response.get("links");
                hasMore = links != null && links.stream().anyMatch(link -> "next".equals(link.get("rel")));
                page++;
            }

            // Ensure we don't exceed the limit
            if (allRows.size() > effectiveLimit) {
                allRows = allRows.subList(0, effectiveLimit);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("rows", allRows);
            result.put("columns", columns);
            result.put("totalCount", allRows.size());
            result.put("limit", effectiveLimit);
            return result;

        } catch (Exception e) {
            log.error("Error executing DQL query", e);
            return errorResult("Query failed: " + e.getMessage());
        }
    }

    /** Standard failure payload — matches the success shape minus the data. */
    private Map<String, Object> errorResult(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("rows", new ArrayList<>());
        result.put("columns", new ArrayList<>());
        result.put("error", message);
        return result;
    }

    /**
     * Returns an error message if {@code dqlQuery} is not a single SELECT
     * statement, or {@code null} if it is safe to run. Comments are stripped
     * first so a leading {@code /* *}{@code /} or {@code --} cannot mask the verb.
     */
    private String validateReadOnly(String dqlQuery) {
        String stripped = COMMENTS.matcher(dqlQuery).replaceAll(" ").trim();
        if (stripped.isEmpty()) {
            return "Query cannot be empty";
        }

        int space = 0;
        while (space < stripped.length() && !Character.isWhitespace(stripped.charAt(space))) {
            space++;
        }
        String verb = stripped.substring(0, space).toUpperCase();
        if (!READ_ONLY_VERBS.contains(verb)) {
            return "Only SELECT queries are allowed from the Query tab.";
        }

        // Reject a smuggled second statement (e.g. "SELECT ... ; DELETE ...").
        int semi = stripped.indexOf(';');
        if (semi != -1 && !stripped.substring(semi + 1).isBlank()) {
            return "Run one statement at a time.";
        }
        return null;
    }

    private static String firstChars(String value, int max) {
        if (value == null) return "";
        String oneLine = value.replaceAll("\\s+", " ").trim();
        return oneLine.length() <= max ? oneLine : oneLine.substring(0, max) + "…";
    }

    /**
     * Legacy method for backward compatibility
     */
    public Map<String, Object> executeQuery(String dqlQuery) {
        return executeQuery(dqlQuery, 10000); // Default limit
    }

    /**
     * Ensures r_object_id and r_object_type are in the SELECT clause.
     * Skips modification for aggregate queries (count, sum, avg, etc.) and SELECT
     * *.
     */
    private String ensureRequiredColumns(String query) {
        String upperQuery = query.toUpperCase();

        // Check if it's a SELECT query
        if (!upperQuery.startsWith("SELECT")) {
            return query;
        }

        // Find the FROM keyword
        int fromIndex = upperQuery.indexOf(" FROM ");
        if (fromIndex == -1) {
            return query;
        }

        // Extract the SELECT columns part
        String selectPart = query.substring(7, fromIndex).trim(); // After "SELECT "
        String fromPart = query.substring(fromIndex);

        // Check if using SELECT * or aggregate functions
        if (selectPart.equals("*")) {
            return query; // * already includes all columns
        }

        String upperSelectPart = selectPart.toUpperCase();

        // Skip aggregate function queries - don't add columns to count, sum, avg, min,
        // max, etc.
        if (upperSelectPart.contains("COUNT(") || upperSelectPart.contains("SUM(") ||
                upperSelectPart.contains("AVG(") || upperSelectPart.contains("MIN(") ||
                upperSelectPart.contains("MAX(") || upperSelectPart.contains("DISTINCT ")) {
            return query;
        }

        // Only add r_object_id if not present (all persistent objects have this)
        // Don't add r_object_type as not all object types have it (e.g., dm_user, dm_group)
        if (!upperSelectPart.contains("R_OBJECT_ID")) {
            String newSelectPart = "r_object_id, " + selectPart;
            return "SELECT " + newSelectPart + fromPart;
        }

        return query;
    }

    /**
     * Extract the RETURN_TOP limit from user's query if present.
     * Returns the extracted limit or the default limit if not found.
     */
    private int extractReturnTopLimit(String query, int defaultLimit) {
        String upperQuery = query.toUpperCase();

        if (!upperQuery.contains("ENABLE(RETURN_TOP")) {
            return defaultLimit;
        }

        try {
            int enableStart = upperQuery.indexOf("ENABLE(RETURN_TOP");
            int numberStart = enableStart + "ENABLE(RETURN_TOP".length();
            int numberEnd = query.indexOf(')', numberStart);

            if (numberEnd != -1) {
                String numberStr = query.substring(numberStart, numberEnd).trim();
                return Integer.parseInt(numberStr);
            }
        } catch (Exception e) {
            log.warn("Failed to extract RETURN_TOP limit from query, using default: {}", defaultLimit);
        }

        return defaultLimit;
    }

    /**
     * Add DQL ENABLE(RETURN_TOP n) hint to limit results at database level.
     * If user already provided ENABLE(RETURN_TOP in their query, respect it
     * instead of overriding it.
     * The hint is appended at the end of the query, e.g.:
     * SELECT * FROM dm_document ENABLE(RETURN_TOP 100)
     *
     * @param query The DQL query
     * @param limit The maximum number of rows to return
     * @return Query with RETURN_TOP hint
     */
    private String addReturnTopHint(String query, int limit) {
        String trimmedQuery = query.trim();
        String upperQuery = trimmedQuery.toUpperCase();

        // Check if it's a SELECT query
        if (!upperQuery.startsWith("SELECT")) {
            return query; // Not a SELECT query
        }

        // If user already has ENABLE(RETURN_TOP in their query, keep it as-is
        // Respect the user's explicit limit rather than overriding
        if (upperQuery.contains("ENABLE(RETURN_TOP")) {
            return trimmedQuery; // Keep user's original query with their limit
        }

        // Only append ENABLE(RETURN_TOP n) if user didn't specify one
        return trimmedQuery + " ENABLE(RETURN_TOP " + limit + ")";
    }

    /**
     * Transform a single page response and populate columns if empty.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> transformPageResponse(Map<String, Object> response, List<String> columns) {
        Map<String, Object> result = new HashMap<>();

        if (response == null) {
            result.put("rows", new ArrayList<>());
            return result;
        }

        // Transform entries
        List<Map<String, Object>> rows = new ArrayList<>();

        List<Map<String, Object>> entries = (List<Map<String, Object>>) response.get("entries");
        if (entries != null) {
            for (Map<String, Object> entry : entries) {
                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        // Extract column names from first row (if not already done)
                        if (columns.isEmpty()) {
                            columns.addAll(props.keySet());
                        }

                        // Create ordered row data
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (String col : columns) {
                            row.put(col, props.get(col));
                        }
                        rows.add(row);
                    }
                }
            }
        }

        result.put("rows", rows);
        return result;
    }
}
