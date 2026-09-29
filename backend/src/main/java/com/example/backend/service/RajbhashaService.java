package com.example.backend.service;

import com.example.backend.config.DctmConfig;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class RajbhashaService {

    private final DctmConfig dctmConfig;
    private final RestClient restClient;

    public RajbhashaService(DctmConfig dctmConfig, RestClient.Builder restClientBuilder) {
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
     * Get Rajbhasha report with summary and totals.
     * Parameters follow the same pattern as Digidak reports.
     * Default dates (per requirement): From = 01/01/2025, To = today's date
     *
     * DEBUG: Added detailed logging to file to troubleshoot 0 count issue
     */
    public Map<String, Object> getRajbhashaReport(
            String hoRo,
            String location,
            String deptNames,
            String fromDate,
            String toDate) {
        try {
            log.info("========== RAJBHASHA REPORT REQUEST START ==========");
            log.info("Parameters: hoRo={}, location={}, deptNames={}, fromDate={}, toDate={}",
                     hoRo, location, deptNames, fromDate, toDate);

            // Validate office type
            if (hoRo == null || hoRo.isBlank()) {
                log.error("Validation failed: Office type is required");
                return buildErrorResponse("Office type is required");
            }

            String officeType = hoRo.trim().toUpperCase();
            boolean isRoTe = "RO".equals(officeType) || "TE".equals(officeType);
            log.info("Office type: {} (isRoTe: {})", officeType, isRoTe);

            // Validate location for RO/TE
            if (isRoTe && (location == null || location.isBlank())) {
                log.error("Validation failed: Location is required for RO/TE");
                return buildErrorResponse("Location is required for RO/TE");
            }

            // Validate department for HO
            if (!isRoTe && (deptNames == null || deptNames.isBlank())) {
                log.error("Validation failed: Department is required for HO");
                return buildErrorResponse("Department is required for HO");
            }

            // Set default dates if not provided (as per requirement)
            if (fromDate == null || fromDate.trim().isEmpty()) {
                fromDate = "01/01/2025";
                log.info("Applied default fromDate: {}", fromDate);
            } else {
                fromDate = formatDateToDDMMYYYY(fromDate);
                log.info("Using provided fromDate: {}", fromDate);
            }

            if (toDate == null || toDate.trim().isEmpty()) {
                toDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                log.info("Applied default toDate (today): {}", toDate);
            } else {
                toDate = formatDateToDDMMYYYY(toDate);
                log.info("Using provided toDate: {}", toDate);
            }

            // Extract value_1, value_2, value_3
            String value1, value2, value3;
            if (isRoTe) {
                value1 = location.trim();
                value2 = officeType.toLowerCase();
                value3 = getLocationShortCode(location.trim()).toLowerCase();
            } else {
                value1 = deptNames.trim().toUpperCase();
                value2 = "ho";
                value3 = deptNames.trim().toLowerCase();
            }

            log.info("Query parameters calculated: value1={}, value2={}, value3={}, fromDate={}, toDate={}",
                    value1, value2, value3, fromDate, toDate);

            // Grid 1: Execute queries
            log.info("Executing Grid 1 - Query 1: Total Letters in Hindi");
            long count1 = executeTotalLettersInHindi(value1, value2, value3, fromDate, toDate);
            log.info("Query 1 result: {}", count1);

            log.info("Executing Grid 1 - Query 2: Replied in Hindi");
            long count2 = executeRepliedInHindi(value1, value2, value3, fromDate, toDate);
            log.info("Query 2 result: {}", count2);

            log.info("Executing Grid 1 - Query 3: Replied in English");
            long count3 = executeRepliedInEnglish(value1, value2, value3, fromDate, toDate);
            log.info("Query 3 result: {}", count3);

            // Grid 1: Build response
            Map<String, Object> result = new HashMap<>();
            Map<String, Object> grid1 = new HashMap<>();

            Map<String, Object> row1 = new HashMap<>();
            row1.put("summary", "Total no. of letters received in Hindi");
            row1.put("total", count1);

            Map<String, Object> row2 = new HashMap<>();
            row2.put("summary", "Out of above how many were replied in Hindi");
            row2.put("total", count2);

            Map<String, Object> row3 = new HashMap<>();
            row3.put("summary", "Out of above how many were replied in English");
            row3.put("total", count3);

            Map<String, Object> row4 = new HashMap<>();
            row4.put("summary", "Out of above how many letters were not required to be replied to");
            row4.put("total", count1 - count2 + count3);  // Calculated as count1 - count2 + count3

            grid1.put("rows", new Map[]{row1, row2, row3, row4});
            result.put("grid1", grid1);

            // Grid 2: Regional analysis
            Map<String, Object> grid2 = new HashMap<>();
            Map<String, Object> regionA = executeGrid2RegionA(value1, value2, value3, fromDate, toDate);
            Map<String, Object> regionB = executeGrid2RegionB(value1, value2, value3, fromDate, toDate);
            grid2.put("rows", new Map[]{regionA, regionB});
            result.put("grid2", grid2);

            // Grid 3: Outbound letters by region
            log.info("Executing Grid 3 - Outbound letters by region");
            Map<String, Object> grid3 = new HashMap<>();
            Map<String, Object> toRegionA = executeGrid3RegionA(value1, fromDate, toDate);
            Map<String, Object> toRegionB = executeGrid3RegionB(value1, fromDate, toDate);
            Map<String, Object> toRegionC = executeGrid3RegionC(value1, fromDate, toDate);

            // Calculate Total row
            long totalHindi = (long) toRegionA.get("hindi_count") + (long) toRegionB.get("hindi_count") + (long) toRegionC.get("hindi_count");
            long totalEnglish = (long) toRegionA.get("english_count") + (long) toRegionB.get("english_count") + (long) toRegionC.get("english_count");
            long totalLettersIssued = totalHindi + totalEnglish;

            // Total percentage = sum of individual region percentages
            String percentageA = (String) toRegionA.get("percentage");
            String percentageB = (String) toRegionB.get("percentage");
            String percentageC = (String) toRegionC.get("percentage");

            double percentAValue = Double.parseDouble(percentageA.replace("%", ""));
            double percentBValue = Double.parseDouble(percentageB.replace("%", ""));
            double percentCValue = Double.parseDouble(percentageC.replace("%", ""));
            double totalPercentage = percentAValue + percentBValue + percentCValue;

            Map<String, Object> totalRow = new HashMap<>();
            totalRow.put("summary", "Total");
            totalRow.put("hindi_bilingual", totalHindi);
            totalRow.put("english_only", totalEnglish);
            totalRow.put("total_letters_issued", totalLettersIssued);
            totalRow.put("percentage", String.format("%.2f%%", totalPercentage));

            grid3.put("rows", new Map[]{toRegionA, toRegionB, toRegionC, totalRow});
            result.put("grid3", grid3);

            result.put("success", true);

            log.info("========== RAJBHASHA REPORT REQUEST SUCCESS ==========");
            return result;

        } catch (Exception e) {
            log.error("========== RAJBHASHA REPORT REQUEST FAILED ==========", e);
            log.error("Error message: {}", e.getMessage());
            return buildErrorResponse("Failed to get Rajbhasha report: " + e.getMessage());
        }
    }

    /**
     * Query 1: Total no. of letters received in Hindi
     */
    private long executeTotalLettersInHindi(String value1, String value2, String value3,
                                           String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder " +
            "where is_group=false " +
            "and nature_of_correspondence != 'DO Letter' " +
            "and is_migrated=false " +
            "and status!='Saved' " +
            "and selected_region in ('").append(value1).append("') ");

        dql.append("and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' ");
        dql.append("and languages in ('Hindi', 'Bilingual') ");
        dql.append("and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') ");
        dql.append("AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1");

        log.info("Query 1 - Total Letters in Hindi: {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    /**
     * Query 2: Out of above how many were replied in Hindi
     */
    private long executeRepliedInHindi(String value1, String value2, String value3,
                                      String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder " +
            "where is_group=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder " +
            "where nature_of_correspondence != 'DO Letter' " +
            "and is_migrated=false " +
            "and status!='Saved' " +
            "and selected_region in ('").append(value1).append("') ");

        dql.append("and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' ");
        dql.append("and languages in ('Hindi', 'Bilingual') ");
        dql.append("and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') ");
        dql.append("AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')) ");

        dql.append("and languages in ('Hindi', 'Bilingual') ");
        dql.append("and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') ");
        dql.append("AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')) ");
        dql.append("and status!='Saved'");

        log.info("Query 2 - Replied in Hindi: {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    /**
     * Query 3: Out of above how many were replied in English
     */
    private long executeRepliedInEnglish(String value1, String value2, String value3,
                                        String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder " +
            "where is_group=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder " +
            "where nature_of_correspondence != 'DO Letter' " +
            "and is_migrated=false " +
            "and status!='Saved' " +
            "and selected_region in ('").append(value1).append("') ");

        dql.append("and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' ");
        dql.append("and languages in ('Hindi', 'Bilingual') ");
        dql.append("and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') ");
        dql.append("AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')) ");

        dql.append("and languages in ('English') ");
        dql.append("and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') ");
        dql.append("AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')) ");
        dql.append("and status!='Saved'");

        log.info("Query 3 - Replied in English: {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    /**
     * Execute a COUNT query and return the count value.
     * Includes timeout handling and detailed logging.
     */
    @SuppressWarnings("unchecked")
    private long executeCountQuery(String dql) {
        try {
            String baseUrl = dctmConfig.getUrl() + "/repositories/" + dctmConfig.getRepository();

            log.debug("Documentum REST API URL: {}", baseUrl);
            log.info("DQL Query to execute:");
            log.info("{}", dql);

            long startTime = System.currentTimeMillis();
            log.debug("Query execution started at: {}", startTime);

            Map<String, Object> response = restClient.get()
                    .uri(baseUrl + "?dql={dql}&inline=true&max-results=1", dql)
                    .header("Authorization", getAuthHeader())
                    .header("Accept", "application/vnd.emc.documentum+json")
                    .retrieve()
                    .body(Map.class);

            long elapsedTime = System.currentTimeMillis() - startTime;
            log.info("Query execution completed in: {}ms", elapsedTime);

            if (response == null) {
                log.error("ERROR: Documentum response is NULL");
                return 0L;
            }

            log.debug("Response received from Documentum");
            log.debug("Full response object: {}", response.toString());

            java.util.List<Map<String, Object>> entries =
                    (java.util.List<Map<String, Object>>) response.get("entries");

            log.debug("Response entries list size: {}", (entries != null ? entries.size() : 0));

            if (entries != null && !entries.isEmpty()) {
                Map<String, Object> entry = entries.get(0);
                log.debug("Entry[0] keys: {}", entry.keySet());

                Map<String, Object> content = (Map<String, Object>) entry.get("content");
                if (content != null) {
                    log.debug("Content keys: {}", content.keySet());

                    Map<String, Object> props = (Map<String, Object>) content.get("properties");
                    if (props != null) {
                        log.debug("Properties keys: {}", props.keySet());
                        log.debug("All properties: {}", props.toString());

                        // Try "total" key first (from count(*) as total), then COUNT(*), then first available
                        Object countObj = props.get("total");
                        if (countObj == null) {
                            countObj = props.get("COUNT(*)");
                            if (countObj != null) {
                                log.debug("Found COUNT(*) key");
                            }
                        } else {
                            log.debug("Found 'total' key");
                        }

                        if (countObj == null && !props.isEmpty()) {
                            // Fallback: get the first property value (Documentum returns it as dm_attr_XXXX)
                            countObj = props.values().iterator().next();
                            log.debug("Using first available property value as fallback");
                        }

                        if (countObj != null) {
                            long count = Long.parseLong(countObj.toString());
                            log.info("SUCCESS: Query returned count: {}", count);
                            return count;
                        } else {
                            log.error("ERROR: No count value found in properties. Available keys: {}", props.keySet());
                        }
                    } else {
                        log.error("ERROR: properties object is null. Content keys: {}", content.keySet());
                    }
                } else {
                    log.error("ERROR: content object is null. Entry keys: {}", entry.keySet());
                }
            } else {
                log.error("ERROR: No entries found in response. Entries list is empty or null");
            }

            log.error("RESULT: Query executed but returned 0 (no data extracted)");
            return 0L;

        } catch (Exception e) {
            log.error("EXCEPTION while executing Rajbhasha count query", e);
            log.error("Exception class: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            log.error("Exception stacktrace:", e);
            return 0L;
        }
    }

    private String formatDateToDDMMYYYY(String date) {
        try {
            if (date.contains("-")) {
                // YYYY-MM-DD format
                DateTimeFormatter inputFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
                LocalDate parsedDate = LocalDate.parse(date, inputFormatter);
                DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
                return parsedDate.format(outputFormatter);
            }
            return date;
        } catch (Exception e) {
            log.warn("Error formatting date: {}", date, e);
            return date;
        }
    }

    private String getLocationShortCode(String location) {
        Map<String, String> locationCodes = new HashMap<>();
        locationCodes.put("Andhra Pradesh", "ap");
        locationCodes.put("Arunachal Pradesh", "ar");
        locationCodes.put("Assam", "as");
        locationCodes.put("Bihar", "bh");
        locationCodes.put("Chhattisgarh", "cg");
        locationCodes.put("Goa", "ga");
        locationCodes.put("Gujarat", "gj");
        locationCodes.put("Haryana", "hr");
        locationCodes.put("Himachal Pradesh", "hp");
        locationCodes.put("Jharkhand", "jh");
        locationCodes.put("Karnataka", "ka");
        locationCodes.put("Kerala", "kl");
        locationCodes.put("Madhya Pradesh", "mp");
        locationCodes.put("Maharashtra", "mh");
        locationCodes.put("Manipur", "mn");
        locationCodes.put("Meghalaya", "ml");
        locationCodes.put("Mizoram", "mz");
        locationCodes.put("Nagaland", "nl");
        locationCodes.put("Odisha", "od");
        locationCodes.put("Punjab", "pb");
        locationCodes.put("Rajasthan", "rj");
        locationCodes.put("Sikkim", "sk");
        locationCodes.put("Tamil Nadu", "tn");
        locationCodes.put("Tamilnadu", "tn");
        locationCodes.put("Telangana", "tg");
        locationCodes.put("Tripura", "tr");
        locationCodes.put("Uttar Pradesh", "up");
        locationCodes.put("Uttarakhand", "uk");
        locationCodes.put("West Bengal", "wb");

        return locationCodes.getOrDefault(location, location.toLowerCase().substring(0, 2));
    }

    /**
     * Grid 2 - Region A queries for English letters
     * Region A: Bihar, Chhattisgarh, Haryana, Himachal Pradesh, Jharkhand, Madhya Pradesh, etc.
     */
    private Map<String, Object> executeGrid2RegionA(String value1, String value2, String value3,
                                                     String fromDate, String toDate) {
        log.info("Executing Grid 2 - Region A queries");

        Map<String, Object> regionA = new HashMap<>();
        regionA.put("summary", "From Region 'A'");

        // Letters received in English
        long engCount = executeGrid2Query1RegionA(value1, value2, value3, fromDate, toDate);
        regionA.put("no_of_letters_english", engCount);

        // Replied in Hindi
        long replyHindiCount = executeGrid2Query2RegionA(value1, value2, value3, fromDate, toDate);
        regionA.put("replied_in_hindi", replyHindiCount);

        // Replied in English
        long replyEnglishCount = executeGrid2Query3RegionA(value1, value2, value3, fromDate, toDate);
        regionA.put("replied_in_english", replyEnglishCount);

        // Not replied to = engCount - replyHindiCount + replyEnglishCount
        long notRepliedCount = engCount - replyHindiCount + replyEnglishCount;
        regionA.put("not_replied_to", notRepliedCount);

        return regionA;
    }

    /**
     * Grid 2 - Region B queries for English letters
     * Region B: Gujarat, Maharashtra, Punjab, various departments
     */
    private Map<String, Object> executeGrid2RegionB(String value1, String value2, String value3,
                                                     String fromDate, String toDate) {
        log.info("Executing Grid 2 - Region B queries");

        Map<String, Object> regionB = new HashMap<>();
        regionB.put("summary", "From Region 'B'");

        // Letters received in English
        long engCount = executeGrid2Query1RegionB(value1, value2, value3, fromDate, toDate);
        regionB.put("no_of_letters_english", engCount);

        // Replied in Hindi
        long replyHindiCount = executeGrid2Query2RegionB(value1, value2, value3, fromDate, toDate);
        regionB.put("replied_in_hindi", replyHindiCount);

        // Replied in English
        long replyEnglishCount = executeGrid2Query3RegionB(value1, value2, value3, fromDate, toDate);
        regionB.put("replied_in_english", replyEnglishCount);

        // Not replied to = engCount - replyHindiCount + replyEnglishCount
        long notRepliedCount = engCount - replyHindiCount + replyEnglishCount;
        regionB.put("not_replied_to", notRepliedCount);

        return regionB;
    }

    private long executeGrid2Query1RegionA(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') " +
            "and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in ('Bihar','Chhattisgarh','Haryana','Himachal Pradesh','Jharkhand','Madhya Pradesh','Rajasthan','Uttar Pradesh','Uttarakhand','New Delhi','Andaman and Nicobar','Bird Lucknow','NBSC Lucknow') " +
            "and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 ) " +
            "and status!='Saved' and languages in ('English')");
        log.info("Grid 2 Region A Query 1 (English letters): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid2Query2RegionA(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in ('Bihar','Chhattisgarh','Haryana','Himachal Pradesh','Jharkhand','Madhya Pradesh','Rajasthan','Uttar Pradesh','Uttarakhand','New Delhi','Andaman and Nicobar','Bird Lucknow','NBSC Lucknow') " +
            "and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved' and languages in ('English')) " +
            "and languages in ('Hindi', 'Bilingual') and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved'");
        log.info("Grid 2 Region A Query 2 (Replied Hindi): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid2Query3RegionA(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') and selected_cgm_group = 'ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in ('Bihar','Chhattisgarh','Haryana','Himachal Pradesh','Jharkhand','Madhya Pradesh','Rajasthan','Uttar Pradesh','Uttarakhand','New Delhi','Andaman and Nicobar','Bird Lucknow','NBSC Lucknow') " +
            "and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved' and languages in ('English')) " +
            "and languages in ('English') and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved'");
        log.info("Grid 2 Region A Query 3 (Replied English): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid2Query1RegionB(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') and selected_cgm_group ='ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in('Gujarat','Maharashtra','Punjab','PFD','DIT','DOR','SECY','RMD','SPD','AD','RAJ','SPPID','FD','FSDD','FSPD','HRMD','ID','IDD','LAW','GSD','RMSMED','DCAS','DDMABI','DEAR','DMFI','DOS','DPSP','DSM','DSSI','CC','CCD','CPD','CVC','CHMNS','DMDS1','DMDS2','CISO','DDSI','CSDD') " +
            "and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved' and languages in ('English')");
        log.info("Grid 2 Region B Query 1 (English letters): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid2Query2RegionB(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count (*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') and selected_cgm_group ='ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in('Gujarat','Maharashtra','Punjab','PFD','DIT','DOR','SECY','RMD','SPD','AD','RAJ','SPPID','FD','FSDD','FSPD','HRMD','ID','IDD','LAW','GSD','RMSMED','DCAS','DDMABI','DEAR','DMFI','DOS','DPSP','DSM','DSSI','CC','CCD','CPD','CVC','CHMNS','DMDS1','DMDS2','CISO','DDSI','CSDD')and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved' and languages in ('English')) " +
            "and languages in ('Hindi', 'Bilingual') and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved'");
        log.info("Grid 2 Region B Query 2 (Replied Hindi): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid2Query3RegionB(String value1, String value2, String value3,
                                          String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and any responding_uid in (select distinct uid_number from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and selected_region in ('").append(value1).append("') and selected_cgm_group ='ecm_digidak_").append(value2).append("_").append(value3).append("_cgm' " +
            "and login_region in('Gujarat','Maharashtra','Punjab','PFD','DIT','DOR','SECY','RMD','SPD','AD','RAJ','SPPID','FD','FSDD','FSPD','HRMD','ID','IDD','LAW','GSD','RMSMED','DCAS','DDMABI','DEAR','DMFI','DOS','DPSP','DSM','DSSI','CC','CCD','CPD','CVC','CHMNS','DMDS1','DMDS2','CISO','DDSI','CSDD')and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved' and languages in ('English')) " +
            "and languages in ('English') and (r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1) " +
            "and status!='Saved'");
        log.info("Grid 2 Region B Query 3 (Replied English): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    /**
     * Grid 3 - Region A queries (Outbound letters)
     * Region A: RO-BR, RO-CH, RO-HR, RO-HP, RO-JH, RO-MP, RO-RJ, RO-UP, RO-UK, RO-DL, RO-AN, TE-BL, TE-NC
     */
    private Map<String, Object> executeGrid3RegionA(String value1, String fromDate, String toDate) {
        log.info("Executing Grid 3 - To Region A queries");

        Map<String, Object> regionA = new HashMap<>();
        regionA.put("summary", "To Region 'A'");

        // Hindi/Bilingual count
        long hindiCount = executeGrid3Query1RegionA(value1, fromDate, toDate);
        regionA.put("hindi_count", hindiCount);
        regionA.put("hindi_bilingual", hindiCount);

        // English only count
        long englishCount = executeGrid3Query2RegionA(value1, fromDate, toDate);
        regionA.put("english_count", englishCount);
        regionA.put("english_only", englishCount);

        // Total letters issued
        long totalLetters = hindiCount + englishCount;
        regionA.put("total_letters_issued", totalLetters);

        // Percentage: count1 / count3 * 100
        double percentage = (totalLetters > 0) ? (hindiCount * 100.0) / totalLetters : 0;
        regionA.put("percentage", String.format("%.2f%%", percentage));

        return regionA;
    }

    /**
     * Grid 3 - Region B queries (Outbound letters)
     * Region B: RO-PN, RO-MH, RO-GJ, HO-AD, HO-RAJ, HO-SPPID, HO-FD, HO-FSDD, HO-FSPD, HO-HRMD, HO-ID, HO-IDD, HO-LAW, HO-GSD, HO-RMSMED, HO-DCAS, HO-DDMABI, HO-DEAR, HO-DMFI, HO-DOS, HO-DPSP, HO-DSM, HO-DSSI, HO-CC, HO-CCD, HO-CPD, HO-CVC, HO-CHMNS, HO-DMDS1, HO-DMDS2, HO-CISO, HO-DDSI, HO-CSDD
     */
    private Map<String, Object> executeGrid3RegionB(String value1, String fromDate, String toDate) {
        log.info("Executing Grid 3 - To Region B queries");

        Map<String, Object> regionB = new HashMap<>();
        regionB.put("summary", "To Region 'B'");

        // Hindi/Bilingual count
        long hindiCount = executeGrid3Query1RegionB(value1, fromDate, toDate);
        regionB.put("hindi_count", hindiCount);
        regionB.put("hindi_bilingual", hindiCount);

        // English only count
        long englishCount = executeGrid3Query2RegionB(value1, fromDate, toDate);
        regionB.put("english_count", englishCount);
        regionB.put("english_only", englishCount);

        // Total letters issued
        long totalLetters = hindiCount + englishCount;
        regionB.put("total_letters_issued", totalLetters);

        // Percentage: count1 / count3 * 100
        double percentage = (totalLetters > 0) ? (hindiCount * 100.0) / totalLetters : 0;
        regionB.put("percentage", String.format("%.2f%%", percentage));

        return regionB;
    }

    /**
     * Grid 3 - Region C queries (Outbound letters)
     * Region C: RO-AR, RO-AD, RO-AS, RO-GA, RO-KA, RO-KL, RO-MN, RO-ML, RO-MZ, RO-NL, RO-OR, RO-SK, RO-TN, RO-TG, RO-TR, RO-WB, RO-JK, TE-BK, TE-BM
     */
    private Map<String, Object> executeGrid3RegionC(String value1, String fromDate, String toDate) {
        log.info("Executing Grid 3 - To Region C queries");

        Map<String, Object> regionC = new HashMap<>();
        regionC.put("summary", "To Region 'C'");

        // Hindi/Bilingual count
        long hindiCount = executeGrid3Query1RegionC(value1, fromDate, toDate);
        regionC.put("hindi_count", hindiCount);
        regionC.put("hindi_bilingual", hindiCount);

        // English only count
        long englishCount = executeGrid3Query2RegionC(value1, fromDate, toDate);
        regionC.put("english_count", englishCount);
        regionC.put("english_only", englishCount);

        // Total letters issued
        long totalLetters = hindiCount + englishCount;
        regionC.put("total_letters_issued", totalLetters);

        // Percentage: count1 / count3 * 100
        double percentage = (totalLetters > 0) ? (hindiCount * 100.0) / totalLetters : 0;
        regionC.put("percentage", String.format("%.2f%%", percentage));

        return regionC;
    }

    private long executeGrid3Query1RegionA(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-BR','RO-CH','RO-HR','RO-HP','RO-JH','RO-MP','RO-RJ','RO-UP','RO-UK','RO-DL','RO-AN','TE-BL','TE-NC') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('Hindi', 'Bilingual')");
        log.info("Grid 3 Region A Query 1 (Hindi/Bilingual): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid3Query2RegionA(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-BR','RO-CH','RO-HR','RO-HP','RO-JH','RO-MP','RO-RJ','RO-UP','RO-UK','RO-DL','RO-AN','TE-BL','TE-NC') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('English')");
        log.info("Grid 3 Region A Query 2 (English Only): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid3Query1RegionB(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-PN','RO-MH','RO-GJ','HO-PFD','HO-DIT','HO-DOR','HO-SECY','HO-RMD','HO-SPD','HO-AD','HO-RAJ','HO-SPPID','HO-FD','HO-FSDD','HO-FSPD','HO-HRMD','HO-ID','HO-IDD','HO-LAW','HO-GSD','HO-RMSMED','HO-DCAS','HO-DDMABI','HO-DEAR','HO-DMFI','HO-DOS','HO-DPSP','HO-DSM','HO-DSSI','HO-CC','HO-CCD','HO-CPD','HO-CVC','HO-CHMNS','HO-DMDS1','HO-DMDS2','HO-DMDS3','HO-CISO','HO-DDSI','HO-CSDD') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('Hindi', 'Bilingual')");
        log.info("Grid 3 Region B Query 1 (Hindi/Bilingual): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid3Query2RegionB(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-PN','RO-MH','RO-GJ','HO-PFD','HO-DIT','HO-DOR','HO-SECY','HO-RMD','HO-SPD','HO-AD','HO-RAJ','HO-SPPID','HO-FD','HO-FSDD','HO-FSPD','HO-HRMD','HO-ID','HO-IDD','HO-LAW','HO-GSD','HO-RMSMED','HO-DCAS','HO-DDMABI','HO-DEAR','HO-DMFI','HO-DOS','HO-DPSP','HO-DSM','HO-DSSI','HO-CC','HO-CCD','HO-CPD','HO-CVC','HO-CHMNS','HO-DMDS1','HO-DMDS2','HO-DMDS3','HO-CISO','HO-DDSI','HO-CSDD') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('English')");
        log.info("Grid 3 Region B Query 2 (English Only): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid3Query1RegionC(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-AR','RO-AD','RO-AS','RO-GA','RO-KA','RO-KL','RO-MN','RO-ML','RO-MZ','RO-NL','RO-OR','RO-SK','RO-TN','RO-TG','RO-TR','RO-WB','RO-JK','TE-BK','TE-BM') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('Hindi', 'Bilingual')");
        log.info("Grid 3 Region C Query 1 (Hindi/Bilingual): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    private long executeGrid3Query2RegionC(String value1, String fromDate, String toDate) {
        StringBuilder dql = new StringBuilder(
            "select count(*) as total from cms_digidak_folder where is_group=false and is_migrated=false " +
            "and login_region in ('").append(value1).append("') " +
            "and region in ('RO-AR','RO-AD','RO-AS','RO-GA','RO-KA','RO-KL','RO-MN','RO-ML','RO-MZ','RO-NL','RO-OR','RO-SK','RO-TN','RO-TG','RO-TR','RO-WB','RO-JK','TE-BK','TE-BM') " +
            "and r_creation_date>=DATE('").append(fromDate).append("','dd/MM/yyyy') AND r_creation_date<=DATE('").append(toDate).append("','dd/MM/yyyy')+1 " +
            "and status!='Saved' and decision='Outward' and languages in ('English')");
        log.info("Grid 3 Region C Query 2 (English Only): {}", dql.toString());
        return executeCountQuery(dql.toString());
    }

    /**
     * Export Rajbhasha report to Word document
     */
    public byte[] exportToWord(Map<String, Object> reportData) throws IOException {
        XWPFDocument document = new XWPFDocument();

        // Add title
        XWPFParagraph titlePara = document.createParagraph();
        titlePara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun titleRun = titlePara.createRun();
        titleRun.setText("राजभाषा रिपोर्ट (Rajbhasha Report)");
        titleRun.setBold(true);
        titleRun.setFontSize(16);

        // Add date
        XWPFParagraph datePara = document.createParagraph();
        datePara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun dateRun = datePara.createRun();
        dateRun.setText("रिपोर्ट तारीख (Report Date): " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));

        document.createParagraph(); // spacing

        // Grid 1
        addGrid1ToDocument(document, (Map<String, Object>) reportData.get("grid1"));

        document.createParagraph(); // spacing

        // Grid 2
        addGrid2ToDocument(document, (Map<String, Object>) reportData.get("grid2"));

        document.createParagraph(); // spacing

        // Grid 3
        addGrid3ToDocument(document, (Map<String, Object>) reportData.get("grid3"));

        // Convert to bytes
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        document.write(baos);
        document.close();

        return baos.toByteArray();
    }

    private void addGrid1ToDocument(XWPFDocument document, Map<String, Object> grid1) {
        // Main heading
        XWPFParagraph mainHeading = document.createParagraph();
        XWPFRun mainHeadingRun = mainHeading.createRun();
        mainHeadingRun.setText("I. हिन्दी में प्राप्त पत्रों के उत्तर हिन्दी में दिए जाने की स्थिति (राजभाषा नियम-5)");
        mainHeadingRun.setBold(true);
        mainHeadingRun.setFontSize(11);

        XWPFParagraph subHeading = document.createParagraph();
        XWPFRun subHeadingRun = subHeading.createRun();
        subHeadingRun.setText("Status of reply in Hindi to the letters received in Hindi (Official Language Rule 5)");
        subHeadingRun.setBold(true);
        subHeadingRun.setFontSize(10);

        XWPFTable table = document.createTable(1, 3);
        table.setWidth("100%");
        table.getRow(0).getCell(0).setWidth("12%");
        table.getRow(0).getCell(1).setWidth("63%");
        table.getRow(0).getCell(2).setWidth("25%");

        // Data rows with labels as per template
        Object[] rows = (Object[]) grid1.get("rows");
        String[] labelCodes = { "(क)(a)", "(ख)(b)", "(ग)(c)", "(घ)(d)" };
        String[] labelTexts = {
            "हिन्दी में प्राप्त पत्रों की कुल संख्या\nTotal no. of letters received in Hindi",
            "इनमें से कितनों के उत्तर हिन्दी में दिए गए\nOut of the above how many were replied to in Hindi",
            "उक्त (क) में से कितनों के उत्तर अंग्रेज़ी में दिए गए\nOut of the above (a) how many were replied to in English",
            "उक्त (क) में से कितने पत्रों का उत्तर देना अपेक्षित नहीं था\nOut of the above (a) how many letters were not required to be replied to."
        };

        for (int i = 0; i < rows.length && i < labelTexts.length; i++) {
            Map<String, Object> rowData = (Map<String, Object>) rows[i];
            XWPFTableRow newRow = table.createRow();
            newRow.setHeight(800); // Extra height for multi-line content

            // Column 1: Label code
            XWPFTableCell codeCell = newRow.getCell(0);
            codeCell.setText("");
            XWPFParagraph codePara = codeCell.getParagraphs().get(0);
            codePara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun codeRun = codePara.createRun();
            codeRun.setText(labelCodes[i]);
            codeRun.setBold(true);

            // Column 2: Label text (Hindi + English on next line)
            XWPFTableCell labelCell = newRow.getCell(1);
            labelCell.setText("");
            String[] textParts = labelTexts[i].split("\n");
            XWPFParagraph labelPara = labelCell.getParagraphs().get(0);
            labelPara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun hindiRun = labelPara.createRun();
            hindiRun.setText(textParts[0]);
            hindiRun.setBold(true);

            labelPara.createRun().addBreak();

            XWPFRun englishRun = labelPara.createRun();
            englishRun.setText(textParts[1]);
            englishRun.setBold(true);

            // Column 3: Total value
            XWPFTableCell totalCell = newRow.getCell(2);
            totalCell.setText("");
            XWPFParagraph totalPara = totalCell.getParagraphs().get(0);
            totalPara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun totalRun = totalPara.createRun();
            totalRun.setText(rowData.get("total").toString());
            totalRun.setBold(true);
        }
    }

    private void addGrid2ToDocument(XWPFDocument document, Map<String, Object> grid2) {
        // Blank line before Grid 2
        document.createParagraph();

        // Main heading
        XWPFParagraph mainHeading = document.createParagraph();
        XWPFRun mainHeadingRun = mainHeading.createRun();
        mainHeadingRun.setText("II. अंग्रेजी में प्राप्त पत्रों के उत्तर हिन्दी में दिए जाने की स्थिति (केवल 'क' और 'ख' क्षेत्र में स्थित कार्यालयों के लिए)");
        mainHeadingRun.setBold(true);
        mainHeadingRun.setFontSize(11);

        XWPFParagraph subHeading = document.createParagraph();
        XWPFRun subHeadingRun = subHeading.createRun();
        subHeadingRun.setText("Status of letters received in English & replied to in Hindi (applicable to offices located in 'A' & 'B' Regions)");
        subHeadingRun.setBold(true);
        subHeadingRun.setFontSize(10);

        XWPFTable table = document.createTable(1, 5);
        table.setWidth("100%");
        table.getRow(0).getCell(0).setWidth("18%");
        table.getRow(0).getCell(1).setWidth("18%");
        table.getRow(0).getCell(2).setWidth("18%");
        table.getRow(0).getCell(3).setWidth("18%");
        table.getRow(0).getCell(4).setWidth("28%");

        // Header row - Column 1: Empty (Region), Columns 2-5: Letter counts
        String[] headerLabels = {
            "",
            "अंग्रेजी में प्राप्त पत्रों की संख्या\nNo. of letters received in English",
            "इनमें से कितनों के उत्तर हिन्दी में दिए गए\nOut of these how many were replied to in Hindi",
            "इनमें से कितनों के उत्तर अंग्रेजी में दिए गए\nOut of these how many were replied to in English",
            "इनमें से कितनों के उत्तर अपेक्षित नहीं थे\nout of these how many letters were not required to be replied to"
        };

        for (int col = 0; col < headerLabels.length; col++) {
            XWPFTableCell headerCell = table.getRow(0).getCell(col);
            headerCell.setText("");
            String[] textParts = headerLabels[col].split("\n");
            XWPFParagraph headerPara = headerCell.getParagraphs().get(0);
            headerPara.setAlignment(col == 0 ? ParagraphAlignment.CENTER : ParagraphAlignment.CENTER);

            for (int j = 0; j < textParts.length; j++) {
                if (j > 0) headerPara.createRun().addBreak();
                XWPFRun headerRun = headerPara.createRun();
                headerRun.setText(textParts[j]);
                headerRun.setBold(true);
            }
        }

        // Region labels as per template
        String[] regionLabels = {
            "'क' क्षेत्र से\nFrom Region A",
            "'ख' क्षेत्र से\nFrom Region B"
        };

        // Data
        Object[] rows = (Object[]) grid2.get("rows");
        for (int i = 0; i < rows.length && i < regionLabels.length; i++) {
            Map<String, Object> rowData = (Map<String, Object>) rows[i];
            XWPFTableRow newRow = table.createRow();
            newRow.setHeight(800);

            // Column 1: Region label
            XWPFTableCell regionCell = newRow.getCell(0);
            regionCell.setText("");
            String[] regionParts = regionLabels[i].split("\n");
            XWPFParagraph regionPara = regionCell.getParagraphs().get(0);
            regionPara.setAlignment(ParagraphAlignment.CENTER);

            // Add blank line above Hindi
            XWPFRun blankLineRun = regionPara.createRun();
            blankLineRun.addBreak();

            XWPFRun hindiRegionRun = regionPara.createRun();
            hindiRegionRun.setText(" " + regionParts[0] + " ");
            hindiRegionRun.setBold(true);
            regionPara.createRun().addBreak();
            XWPFRun englishRegionRun = regionPara.createRun();
            englishRegionRun.setText(" " + regionParts[1] + " ");
            englishRegionRun.setBold(true);

            // Columns 2-5: Data values
            long[] values = {
                Long.parseLong(rowData.get("no_of_letters_english").toString()),
                Long.parseLong(rowData.get("replied_in_hindi").toString()),
                Long.parseLong(rowData.get("replied_in_english").toString()),
                Long.parseLong(rowData.get("not_replied_to").toString())
            };

            for (int col = 0; col < values.length; col++) {
                XWPFTableCell valueCell = newRow.getCell(col + 1);
                valueCell.setText("");
                XWPFParagraph valuePara = valueCell.getParagraphs().get(0);
                valuePara.setAlignment(ParagraphAlignment.CENTER);

                // Add blank line above value with spacing
                XWPFRun blankValueRun = valuePara.createRun();
                blankValueRun.addBreak();

                XWPFRun valueRun = valuePara.createRun();
                valueRun.setText(" " + String.valueOf(values[col]) + " ");
                valueRun.setBold(true);
            }
        }
    }

    private void addGrid3ToDocument(XWPFDocument document, Map<String, Object> grid3) {
        // Blank line before Grid 3
        document.createParagraph();
        // Main heading
        XWPFParagraph mainHeading = document.createParagraph();
        XWPFRun mainHeadingRun = mainHeading.createRun();
        mainHeadingRun.setText("III. भेजे गए मूल पत्रों (ईमेल सहित) का ब्योरा");
        mainHeadingRun.setBold(true);
        mainHeadingRun.setFontSize(11);

        XWPFParagraph subHeading = document.createParagraph();
        XWPFRun subHeadingRun = subHeading.createRun();
        subHeadingRun.setText("Details of original letters (Including Emails) issued");
        subHeadingRun.setBold(true);
        subHeadingRun.setFontSize(10);

        XWPFTable table = document.createTable(1, 5);
        table.setWidth("100%");
        table.getRow(0).getCell(0).setWidth("18%");
        table.getRow(0).getCell(1).setWidth("18%");
        table.getRow(0).getCell(2).setWidth("18%");
        table.getRow(0).getCell(3).setWidth("18%");
        table.getRow(0).getCell(4).setWidth("28%");

        // Header row - Column 1: Empty (Region), Columns 2-5: Letter counts
        String[] headerLabels = {
            "",
            "हिन्दी में/ द्विभाषी\nIn Hindi/Bilingual",
            "केवल अंग्रेजी में\nIn English only",
            "भेजे गए पत्रों की कुल संख्या\nTotal No. of Letters Issues",
            "हिन्दी में /द्विभाषी भेजे गए पत्रों का प्रतिशत\nPercentage of letters sent in Hindi/Bilingual"
        };

        for (int col = 0; col < headerLabels.length; col++) {
            XWPFTableCell headerCell = table.getRow(0).getCell(col);
            headerCell.setText("");
            String[] textParts = headerLabels[col].split("\n");
            XWPFParagraph headerPara = headerCell.getParagraphs().get(0);
            headerPara.setAlignment(ParagraphAlignment.CENTER);

            for (int j = 0; j < textParts.length; j++) {
                if (j > 0) headerPara.createRun().addBreak();
                XWPFRun headerRun = headerPara.createRun();
                headerRun.setText(textParts[j]);
                headerRun.setBold(true);
            }
        }

        // Region labels as per template
        String[] regionLabels = {
            "'क' क्षेत्र\nFrom Region A",
            "'ख' क्षेत्र को\nFrom Region B",
            "'ग' क्षेत्र को\nFrom Region c",
            "कुल\nTotal"
        };

        // Data
        Object[] rows = (Object[]) grid3.get("rows");
        for (int i = 0; i < rows.length && i < regionLabels.length; i++) {
            Map<String, Object> rowData = (Map<String, Object>) rows[i];
            XWPFTableRow newRow = table.createRow();
            newRow.setHeight(800);

            // Column 1: Region label
            XWPFTableCell regionCell = newRow.getCell(0);
            regionCell.setText("");
            String[] regionParts = regionLabels[i].split("\n");
            XWPFParagraph regionPara = regionCell.getParagraphs().get(0);
            regionPara.setAlignment(ParagraphAlignment.CENTER);

            // Add blank line above Hindi
            XWPFRun blankLineRun = regionPara.createRun();
            blankLineRun.addBreak();

            XWPFRun hindiRegionRun = regionPara.createRun();
            hindiRegionRun.setText(" " + regionParts[0] + " ");
            hindiRegionRun.setBold(true);
            regionPara.createRun().addBreak();
            XWPFRun englishRegionRun = regionPara.createRun();
            englishRegionRun.setText(" " + regionParts[1] + " ");
            englishRegionRun.setBold(true);

            // Columns 2-5: Data values
            long hindi = Long.parseLong(rowData.get("hindi_bilingual").toString());
            long english = Long.parseLong(rowData.get("english_only").toString());
            long total = Long.parseLong(rowData.get("total_letters_issued").toString());
            String percentage = rowData.get("percentage").toString();

            long[] values = { hindi, english, total };
            String[] valueTexts = {
                String.valueOf(hindi),
                String.valueOf(english),
                String.valueOf(total),
                percentage
            };

            for (int col = 0; col < 4; col++) {
                XWPFTableCell valueCell = newRow.getCell(col + 1);
                valueCell.setText("");
                XWPFParagraph valuePara = valueCell.getParagraphs().get(0);
                valuePara.setAlignment(ParagraphAlignment.CENTER);

                // Add blank line above value with spacing
                XWPFRun blankValueRun = valuePara.createRun();
                blankValueRun.addBreak();

                XWPFRun valueRun = valuePara.createRun();
                valueRun.setText(" " + valueTexts[col] + " ");
                valueRun.setBold(true);
            }
        }
    }

    private Map<String, Object> buildErrorResponse(String error) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("error", error);
        return result;
    }
}
