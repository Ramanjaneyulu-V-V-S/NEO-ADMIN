package com.example.backend.controller;

import com.example.backend.service.SfsUserAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sfs/user-access")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class SfsUserAccessController {

    private final SfsUserAccessService sfsUserAccessService;

    public SfsUserAccessController(SfsUserAccessService sfsUserAccessService) {
        this.sfsUserAccessService = sfsUserAccessService;
    }

    /**
     * Get locations for RO/TE offices.
     * GET /api/sfs/user-access/locations
     */
    @GetMapping("/locations")
    public ResponseEntity<?> getLocations() {
        try {
            return ResponseEntity.ok(sfsUserAccessService.getLocations());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get users for a specific office type and department.
     * For HO: GET /api/sfs/user-access/users?officeType=HO&department=HRMD
     * For RO/TE: GET /api/sfs/user-access/users?officeType=RO&department=HRMD&location=Chennai
     *
     * Optional role parameter to filter by SFS role group.
     * Optional locationShortCode parameter for Maker/Checker roles.
     */
    @GetMapping("/users")
    public ResponseEntity<?> getUsersByRole(
            @RequestParam String officeType,
            @RequestParam String department,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String locationShortCode) {
        try {
            return ResponseEntity.ok(sfsUserAccessService.getUsersByRole(officeType, department, location, role, locationShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Check if user is already in a group.
     * GET /api/sfs/user-access/check-membership?userName=ajay&role=Digitization&officeType=HO&department=HRMD
     */
    @GetMapping("/check-membership")
    public ResponseEntity<?> checkUserMembership(
            @RequestParam String userName,
            @RequestParam String role,
            @RequestParam String officeType,
            @RequestParam String department,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String locationShortCode) {
        try {
            boolean isMember = sfsUserAccessService.isUserInGroup(userName, role, officeType, department, location, locationShortCode);
            return ResponseEntity.ok(Map.of("isMember", isMember));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Add a user to a group based on role.
     * POST /api/sfs/user-access/add-to-group
     *
     * Body: { userName, role, officeType, department, location?, locationShortCode? }
     */
    @PostMapping("/add-to-group")
    public ResponseEntity<Map<String, Object>> addUserToGroup(@RequestBody Map<String, Object> request) {
        try {
            String userName = (String) request.get("userName");
            String role = (String) request.get("role");
            String officeType = (String) request.get("officeType");
            String department = (String) request.get("department");
            String location = (String) request.get("location");
            String locationShortCode = (String) request.get("locationShortCode");

            return ResponseEntity.ok(sfsUserAccessService.addUserToGroup(userName, role, officeType, department, location, locationShortCode));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
