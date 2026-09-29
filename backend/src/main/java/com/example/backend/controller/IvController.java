package com.example.backend.controller;

import com.example.backend.service.IvPublicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/iv")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class IvController {

    private final IvPublicationService ivPublicationService;

    public IvController(IvPublicationService ivPublicationService) {
        this.ivPublicationService = ivPublicationService;
    }

    @GetMapping("/note-document/{caseId}")
    public ResponseEntity<Map<String, Object>> findNoteDocumentId(@PathVariable String caseId) {
        return ResponseEntity.ok(ivPublicationService.findNoteDocumentId(caseId));
    }

    @GetMapping("/case-documents/{caseId}")
    public ResponseEntity<Map<String, Object>> listCaseDocuments(@PathVariable String caseId) {
        return ResponseEntity.ok(ivPublicationService.listCaseDocuments(caseId));
    }

    @GetMapping("/documents-by-date")
    public ResponseEntity<Map<String, Object>> listDocumentsByDate(@RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(ivPublicationService.listDocumentsByDate(from, to));
    }

    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishToIv(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ivPublicationService.publishToIv(body.get("docId")));
    }
}
