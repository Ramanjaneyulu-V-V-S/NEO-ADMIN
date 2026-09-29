package com.example.backend.controller;

import com.example.backend.service.SfsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sfs")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class SfsController {

    private final SfsService sfsService;

    public SfsController(SfsService sfsService) {
        this.sfsService = sfsService;
    }

    /**
     * Create a cms_sfs_metadata object (Document Type) under /SFS Config/Document Type.
     * POST /api/sfs/document-types
     *
     * Body: { document_type, document_category, serial_number }
     */
    @PostMapping("/document-types")
    public ResponseEntity<Map<String, Object>> createDocumentType(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(sfsService.createDocumentType(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get all document types.
     * GET /api/sfs/document-types
     */
    @GetMapping("/document-types")
    public ResponseEntity<List<Map<String, Object>>> listDocumentTypes() {
        try {
            return ResponseEntity.ok(sfsService.listDocumentTypes());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update a document type by its r_object_id.
     * PUT /api/sfs/document-types/{objectId}
     *
     * Body: { document_type, document_category, serial_number }
     */
    @PutMapping("/document-types/{objectId}")
    public ResponseEntity<Map<String, Object>> updateDocumentType(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(sfsService.updateDocumentType(objectId, request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Delete a document type by its r_object_id.
     * DELETE /api/sfs/document-types/{objectId}
     */
    @DeleteMapping("/document-types/{objectId}")
    public ResponseEntity<Map<String, Object>> deleteDocumentType(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(sfsService.deleteDocumentType(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Create a cms_sfs_metadata object (Document Category) under /SFS Config/Document Type.
     * POST /api/sfs/document-categories
     *
     * Body: { document_type, document_category, serial_number }
     */
    @PostMapping("/document-categories")
    public ResponseEntity<Map<String, Object>> createDocumentCategory(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(sfsService.createDocumentCategory(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get all document categories.
     * GET /api/sfs/document-categories
     */
    @GetMapping("/document-categories")
    public ResponseEntity<List<Map<String, Object>>> listDocumentCategories() {
        try {
            return ResponseEntity.ok(sfsService.listDocumentCategories());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update a document category by its r_object_id.
     * PUT /api/sfs/document-categories/{objectId}
     *
     * Body: { document_type, document_category, serial_number }
     */
    @PutMapping("/document-categories/{objectId}")
    public ResponseEntity<Map<String, Object>> updateDocumentCategory(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(sfsService.updateDocumentCategory(objectId, request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Delete a document category by its r_object_id.
     * DELETE /api/sfs/document-categories/{objectId}
     */
    @DeleteMapping("/document-categories/{objectId}")
    public ResponseEntity<Map<String, Object>> deleteDocumentCategory(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(sfsService.deleteDocumentCategory(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
