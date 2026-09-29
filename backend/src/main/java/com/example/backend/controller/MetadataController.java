package com.example.backend.controller;

import com.example.backend.service.MetadataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/metadata")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class MetadataController {

    private final MetadataService metadataService;

    public MetadataController(MetadataService metadataService) {
        this.metadataService = metadataService;
    }

    /**
     * Create a cms_file_number object under /ECM CONFIG/File Number.
     * POST /api/metadata/file-numbers
     *
     * Body: { object_name, ho_ro, dept_short_code, ro_short_code, description }
     */
    @PostMapping("/file-numbers")
    public ResponseEntity<Map<String, Object>> createFileNumber(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(metadataService.createFileNumber(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update object_name and/or description of a cms_file_number.
     * PUT /api/metadata/file-numbers/{objectId}
     *
     * Body: { object_name, description }
     */
    @PutMapping("/file-numbers/{objectId}")
    public ResponseEntity<Map<String, Object>> updateFileNumber(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(metadataService.updateFileNumber(objectId, request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Validate if a cms_file_number can be deleted (check if any cases use it).
     * GET /api/metadata/file-numbers/validate-delete?hoRo=HO&deptShortCode=ddsi&fileNumber=DDSI-001&roShortCode=
     * Returns: { canDelete: boolean, caseCount: int, message: string }
     */
    @GetMapping("/file-numbers/validate-delete")
    public ResponseEntity<Map<String, Object>> validateFileNumberDelete(
            @RequestParam String hoRo,
            @RequestParam String deptShortCode,
            @RequestParam String fileNumber,
            @RequestParam(required = false) String roShortCode) {
        try {
            return ResponseEntity.ok(metadataService.validateFileNumberDelete(hoRo, deptShortCode, fileNumber, roShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("canDelete", false, "caseCount", 0,
                        "message", "Validation failed: " + e.getMessage()));
        }
    }

    /**
     * Delete a cms_file_number object by its r_object_id.
     * DELETE /api/metadata/file-numbers/{objectId}
     */
    @DeleteMapping("/file-numbers/{objectId}")
    public ResponseEntity<Map<String, Object>> deleteFileNumber(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(metadataService.deleteFileNumber(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Check if a cms_file_number already exists for the given office type, department, and location.
     * GET /api/metadata/file-numbers/check-duplicate?hoRo=HO&deptShortCode=ddsi&fileNumber=DDSI-001&roShortCode=
     * Returns: { exists: boolean }
     */
    @GetMapping("/file-numbers/check-duplicate")
    public ResponseEntity<Map<String, Object>> checkFileNumberDuplicate(
            @RequestParam String hoRo,
            @RequestParam String deptShortCode,
            @RequestParam String fileNumber,
            @RequestParam(required = false) String roShortCode) {
        try {
            return ResponseEntity.ok(metadataService.checkFileNumberDuplicate(hoRo, deptShortCode, fileNumber, roShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("exists", false, "error", e.getMessage()));
        }
    }

    /**
     * List existing cms_file_number objects filtered by office type, department, and optionally location.
     * GET /api/metadata/file-numbers?hoRo=HO&deptShortCode=fsdd
     * GET /api/metadata/file-numbers?hoRo=RO&deptShortCode=bid&roShortCode=jk
     */
    @GetMapping("/file-numbers")
    public ResponseEntity<?> listFileNumbers(
            @RequestParam String hoRo,
            @RequestParam String deptShortCode,
            @RequestParam(required = false, defaultValue = "") String roShortCode) {
        try {
            List<Map<String, Object>> results = metadataService.listFileNumbers(hoRo, deptShortCode, roShortCode);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Create a cms_digidak_metadata object under the specified Digidak config folder.
     * POST /api/metadata/digidak/metadata
     *
     * Body: { input, results, folder_path }
     */
    @PostMapping("/digidak/metadata")
    public ResponseEntity<Map<String, Object>> createDigidakMetadata(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(metadataService.createDigidakMetadata(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * List cms_digidak_metadata objects filtered by input value.
     * GET /api/metadata/digidak/metadata?input=nature_of_correspondence_internal
     */
    @GetMapping("/digidak/metadata")
    public ResponseEntity<?> listDigidakMetadata(@RequestParam String input) {
        try {
            return ResponseEntity.ok(metadataService.listDigidakMetadata(input));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update results (and object_name) of a cms_digidak_metadata by r_object_id.
     * PUT /api/metadata/digidak/metadata/{objectId}
     *
     * Body: { results }
     */
    @PutMapping("/digidak/metadata/{objectId}")
    public ResponseEntity<Map<String, Object>> updateDigidakMetadata(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(metadataService.updateDigidakMetadata(objectId, request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Delete a cms_digidak_metadata object by r_object_id.
     * DELETE /api/metadata/digidak/metadata/{objectId}
     */
    @DeleteMapping("/digidak/metadata/{objectId}")
    public ResponseEntity<Map<String, Object>> deleteDigidakMetadata(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(metadataService.deleteDigidakMetadata(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Create a case type dm_folder under /ECM CONFIG/Case Type.
     * POST /api/metadata/case-types
     * Body: { "object_name": "test" }
     */
    @PostMapping("/case-types")
    public ResponseEntity<Map<String, Object>> createCaseType(@RequestBody Map<String, Object> request) {
        try {
            String objectName = (String) request.get("object_name");
            return ResponseEntity.ok(metadataService.createCaseType(objectName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * List existing case type folders under /ECM CONFIG/Case Type.
     * GET /api/metadata/case-types
     */
    @GetMapping("/case-types")
    public ResponseEntity<?> listCaseTypes() {
        try {
            return ResponseEntity.ok(metadataService.listCaseTypes());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // ─── Hindi Comments ──────────────────────────────────────────────────────

    /**
     * Create a hindi comment dm_folder under /ECM CONFIG/Hindi Comments.
     * POST /api/metadata/hindi-comments
     * Body: { "object_name": "comment text" }
     */
    @PostMapping("/hindi-comments")
    public ResponseEntity<Map<String, Object>> createHindiComment(@RequestBody Map<String, Object> request) {
        try {
            String objectName = (String) request.get("object_name");
            return ResponseEntity.ok(metadataService.createHindiComment(objectName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * List existing hindi comment folders under /ECM CONFIG/Hindi Comments.
     * GET /api/metadata/hindi-comments
     */
    @GetMapping("/hindi-comments")
    public ResponseEntity<?> listHindiComments() {
        try {
            return ResponseEntity.ok(metadataService.listHindiComments());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get filter options for Digidak reports.
     * GET /api/metadata/digidak/filter-options
     */
    @GetMapping("/digidak/filter-options")
    public ResponseEntity<?> getDigidakFilterOptions() {
        try {
            return ResponseEntity.ok(Map.of(
                "languages", List.of("Bilingual", "English", "Hindi", "Others"),
                "mode_of_receipt", List.of("Courier", "DigiDak", "Email", "Hand Delivered", "Others"),
                "priority", List.of("Immediate", "Normal", "Urgent"),
                "secrecy", List.of("Confidential", "Regular", "Secret"),
                "status", List.of("Unread", "Opened", "Assigned", "Assigned Head", "Closed", "Reassigned", "Reassign Head", "Responded", "Follow-Up", "In Process", "Pushback"),
                "type_category", List.of("Information", "Actionable"),
                "source_vertical", List.of("NABARD", "Regional Office", "State Level")
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
