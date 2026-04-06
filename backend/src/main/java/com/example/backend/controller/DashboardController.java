package com.example.backend.controller;

import com.example.backend.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary() {
        try {
            return ResponseEntity.ok(dashboardService.getSummary());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cases-by-dept")
    public ResponseEntity<?> getCasesByDepartment() {
        try {
            return ResponseEntity.ok(dashboardService.getCasesByDepartment());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cases-by-status")
    public ResponseEntity<?> getCasesByStatus() {
        try {
            return ResponseEntity.ok(dashboardService.getCasesByStatus());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cases-by-office")
    public ResponseEntity<?> getCasesByOffice() {
        try {
            return ResponseEntity.ok(dashboardService.getCasesByOffice());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cases-trend")
    public ResponseEntity<?> getCasesTrend() {
        try {
            return ResponseEntity.ok(dashboardService.getCasesTrend());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/workflow-status")
    public ResponseEntity<?> getWorkflowStatus() {
        try {
            return ResponseEntity.ok(dashboardService.getWorkflowStatus());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/cases-by-priority")
    public ResponseEntity<?> getCasesByPriority() {
        try {
            return ResponseEntity.ok(dashboardService.getCasesByPriority());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/users-by-office")
    public ResponseEntity<?> getUsersByOffice() {
        try {
            return ResponseEntity.ok(dashboardService.getUsersByOffice());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
