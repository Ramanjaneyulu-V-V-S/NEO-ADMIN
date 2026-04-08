package com.example.backend.controller;

import com.example.backend.service.DigidakReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reports/digidak")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DigidakReportController {

    private final DigidakReportService reportService;

    public DigidakReportController(DigidakReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getSummary(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-status")
    public ResponseEntity<?> getByStatus(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByStatus(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-type-category")
    public ResponseEntity<?> getByTypeCategory(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByTypeCategory(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-nature")
    public ResponseEntity<?> getByNature(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByNature(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-secrecy")
    public ResponseEntity<?> getBySecrecy(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getBySecrecy(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-priority")
    public ResponseEntity<?> getByPriority(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByPriority(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-vertical")
    public ResponseEntity<?> getByVertical(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByVertical(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/trend")
    public ResponseEntity<?> getTrend(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getTrend(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-decision")
    public ResponseEntity<?> getByDecision(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByDecision(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/by-language")
    public ResponseEntity<?> getByLanguage(@RequestParam Map<String, String> filters) {
        try {
            return ResponseEntity.ok(reportService.getByLanguage(filters));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
