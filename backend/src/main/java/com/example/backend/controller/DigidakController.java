package com.example.backend.controller;

import com.example.backend.service.DigidakService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/digidak")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DigidakController {

    private final DigidakService digidakService;

    public DigidakController(DigidakService digidakService) {
        this.digidakService = digidakService;
    }

    /**
     * Digidak report endpoint with Inbox/Outbox filtering, date range, office type, location and department filters.
     * Always excludes is_migrated=false cases, is_endorsed_letter=false cases
     * Uses mandatory filters: is_ddm=false, decision='Outward'/'Inward', status in specific list, login_cgm_group match
     */
    @GetMapping("/report")
    public Map<String, Object> getDigidakReport(
            @RequestParam(defaultValue = "inbox") String decisionType,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String sourceVertical,
            @RequestParam(defaultValue = "") String entryType,
            @RequestParam(defaultValue = "") String sentTo,
            @RequestParam(defaultValue = "") String region,
            @RequestParam(defaultValue = "false") boolean export,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.getDigidakReport(decisionType, hoRo, location, deptNames, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, sourceVertical, entryType, sentTo, region, export, page, size);
    }

    @GetMapping("/metadata")
    public Map<String, Object> getDigidakMetadata() {
        return digidakService.getDigidakMetadata();
    }

    @GetMapping("/users")
    public Map<String, Object> getDigidakUsers(
            @RequestParam(defaultValue = "") String officeType,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptName) {
        return digidakService.getDigidakUsers(officeType, location, deptName);
    }

    @GetMapping("/inbox")
    public Map<String, Object> getDigidakInbox(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String username,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String entryType,
            @RequestParam(defaultValue = "") String receivedFrom,
            @RequestParam(defaultValue = "") String region,
            @RequestParam(defaultValue = "false") boolean export,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.getDigidakInbox(hoRo, location, deptNames, username, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, entryType, receivedFrom, region, export, page, size);
    }

    /** Quick letter lookup — letter number and/or office type, department/location, date range. */
    @GetMapping("/search")
    public Map<String, Object> searchLetters(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.searchDigidakLetters(q, hoRo, location, deptNames, fromDate, toDate, page, size);
    }

    @GetMapping("/{digidakId}/movement")
    public java.util.List<Map<String, Object>> getDigidakMovement(@PathVariable String digidakId) {
        return digidakService.getDigidakMovement(digidakId);
    }

    @GetMapping("/verticals")
    public java.util.List<Map<String, String>> getDigidakVerticals(
            @RequestParam(defaultValue = "") String officeType,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptName) {
        return digidakService.getDigidakVerticals(officeType, location, deptName);
    }

    @GetMapping("/sent-to-options")
    public java.util.List<String> getDigidakSentToOptions() {
        return digidakService.getDigidakSentToOptions();
    }

    @GetMapping("/received-from-options")
    public java.util.List<String> getDigidakReceivedFromOptions() {
        return digidakService.getDigidakReceivedFromOptions();
    }

    @GetMapping("/draft")
    public Map<String, Object> getDigidakDraft(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String entryType,
            @RequestParam(defaultValue = "false") boolean export,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return digidakService.getDigidakDraft(hoRo, location, deptNames, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, entryType, export, page, size);
    }

    @GetMapping("/count")
    public Map<String, Object> getDigidakCount(
            @RequestParam(defaultValue = "inbox") String decisionType,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String sourceVertical,
            @RequestParam(defaultValue = "") String entryType,
            @RequestParam(defaultValue = "") String sentTo,
            @RequestParam(defaultValue = "") String region) {
        return digidakService.getDigidakCount(decisionType, hoRo, location, deptNames, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, sourceVertical, entryType, sentTo, region);
    }

    @GetMapping("/inbox/count")
    public Map<String, Object> getDigidakInboxCount(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String username,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String entryType,
            @RequestParam(defaultValue = "") String receivedFrom,
            @RequestParam(defaultValue = "") String region) {
        return digidakService.getDigidakInboxCount(hoRo, location, deptNames, username, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, entryType, receivedFrom, region);
    }

    @GetMapping("/draft/count")
    public Map<String, Object> getDigidakDraftCount(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "") String modeOfReceipt,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String secrecy,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String typeCategory,
            @RequestParam(defaultValue = "") String entryType) {
        return digidakService.getDigidakDraftCount(hoRo, location, deptNames, fromDate, toDate,
                language, modeOfReceipt, priority, secrecy, status, typeCategory, entryType);
    }
}
