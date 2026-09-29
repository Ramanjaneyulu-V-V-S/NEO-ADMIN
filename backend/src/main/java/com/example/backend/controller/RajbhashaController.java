package com.example.backend.controller;

import com.example.backend.service.RajbhashaService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/rajbhasha")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class RajbhashaController {

    private final RajbhashaService rajbhashaService;

    public RajbhashaController(RajbhashaService rajbhashaService) {
        this.rajbhashaService = rajbhashaService;
    }

    /**
     * Rajbhasha report endpoint with summary and totals.
     * Returns a grid with 2 columns: Summary and Total
     */
    @GetMapping("/report")
    public Map<String, Object> getRajbhashaReport(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate) {
        return rajbhashaService.getRajbhashaReport(hoRo, location, deptNames, fromDate, toDate);
    }

    /**
     * Export Rajbhasha report to Word document
     */
    @GetMapping("/report/export")
    public ResponseEntity<byte[]> exportRajbhashaReport(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate) {
        try {
            // Get the report data
            Map<String, Object> reportResponse = rajbhashaService.getRajbhashaReport(hoRo, location, deptNames, fromDate, toDate);

            if ((Boolean) reportResponse.getOrDefault("success", false)) {
                // Export to Word
                Map<String, Object> reportData = new java.util.HashMap<>();
                reportData.put("grid1", reportResponse.get("grid1"));
                reportData.put("grid2", reportResponse.get("grid2"));
                reportData.put("grid3", reportResponse.get("grid3"));

                byte[] wordDocument = rajbhashaService.exportToWord(reportData);

                // Set response headers
                String fileName = "Rajbhasha_Report_" + LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy")) + ".docx";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
                headers.setContentDisposition(ContentDisposition.builder("attachment").filename(fileName).build());
                headers.setContentLength(wordDocument.length);

                return ResponseEntity.ok().headers(headers).body(wordDocument);
            } else {
                return ResponseEntity.badRequest().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
