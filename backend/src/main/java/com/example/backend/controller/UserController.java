package com.example.backend.controller;

import com.example.backend.service.OtdsService;
import com.example.backend.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
@Slf4j
public class UserController {

    private final UserService userService;
    private final OtdsService otdsService;

    public UserController(UserService userService, OtdsService otdsService) {
        this.userService = userService;
        this.otdsService = otdsService;
    }

    /**
     * Diagnostic: probes common OTDS REST API base paths to find the correct one.
     * GET /api/users/otds/probe
     */
    @GetMapping("/otds/probe")
    public Map<String, Object> probeOtds() {
        return otdsService.probeConnection();
    }

    /**
     * Diagnostic: returns a single OTDS user's full attributes.
     * Pass the qualified user ID (loginName@partitionName) as the 'userId' query param.
     * GET /api/users/otds/inspect?userId=nirmal.joshi@DCTMPartitions
     */
    @GetMapping("/otds/inspect")
    public ResponseEntity<Map<String, Object>> inspectOtdsUser(
            @RequestParam String userId) {
        try {
            return ResponseEntity.ok(otdsService.inspectPartitionUserAttributes(userId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Search dm_user objects
     * GET /api/users/dm
     */
    @GetMapping("/dm")
    public Map<String, Object> searchDmUsers(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String officeTypeFilter) {
        return userService.searchDmUsers(query, page, size, officeTypeFilter);
    }

    /**
     * List cms_user_profile users belonging to an HO department short code.
     * GET /api/users/by-dept?shortCode=ddsi
     * Optional: GET /api/users/by-dept?shortCode=ddsi&officeType=HO
     */
    @GetMapping("/by-dept")
    public List<Map<String, Object>> getUsersByDept(
            @RequestParam String shortCode,
            @RequestParam(required = false) String officeType) {
        return userService.getUsersByDeptShortCode(shortCode, officeType);
    }

    /**
     * List cms_user_profile users by location (for RO/TE offices).
     * GET /api/users/by-location?location=Chennai
     * Optional: GET /api/users/by-location?location=Chennai&officeType=RO
     */
    @GetMapping("/by-location")
    public List<Map<String, Object>> getUsersByLocation(
            @RequestParam String location,
            @RequestParam(required = false) String officeType) {
        return userService.getUsersByLocation(location, officeType);
    }

    /**
     * Append a vertical folder's r_object_id to vertical_ids on cms_user_profile.
     * POST /api/users/profiles/{objectId}/vertical-ids
     */
    @PostMapping("/profiles/{objectId}/vertical-ids")
    public ResponseEntity<Map<String, Object>> addVerticalIdToProfile(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> request) {
        String verticalGroupName = (String) request.get("verticalGroupName");
        try {
            return ResponseEntity.ok(userService.addVerticalIdToProfile(objectId, verticalGroupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Remove a vertical folder's r_object_id from vertical_ids on cms_user_profile.
     * DELETE /api/users/profile-vertical-ids?userLoginName=abc&verticalGroupName=ecm_ho_ddsi_bpe
     */
    @DeleteMapping("/profile-vertical-ids")
    public ResponseEntity<Map<String, Object>> removeVerticalIdFromProfile(
            @RequestParam String userLoginName,
            @RequestParam String verticalGroupName) {
        try {
            return ResponseEntity.ok(userService.removeVerticalIdFromProfile(userLoginName, verticalGroupName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update editable properties on a dm_user.
     * user_state is stripped from the Documentum payload — only the OTDS account is
     * enabled/disabled based on it (user_state=1 → disable OTDS, user_state=0 → enable).
     * PATCH /api/users/dm/{loginName}
     */
    @PatchMapping("/dm/{loginName:.+}")
    public ResponseEntity<Map<String, Object>> updateDmUser(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> properties) {
        try {
            // Extract OTDS-only fields before passing to DCTM
            Object userStateRaw    = properties.get("user_state");
            String userLoginName   = (String) properties.get("user_login_name");
            Map<String, Object> dctmProps = new java.util.HashMap<>(properties);
            dctmProps.remove("user_state");
            dctmProps.remove("user_login_name");

            Map<String, Object> result = userService.updateDmUser(loginName, dctmProps);

            // Sync OTDS account enable/disable based on user_state
            if (userStateRaw != null && userLoginName != null && !userLoginName.isBlank()) {
                int state = ((Number) userStateRaw).intValue();
                String otdsUserId = userLoginName + "@DCTMPartitions";
                try {
                    otdsService.setAccountDisabled(otdsUserId, state == 1);
                    log.info("OTDS account {} for '{}'", state == 1 ? "disabled" : "enabled", otdsUserId);
                } catch (Exception otdsEx) {
                    log.warn("OTDS account status sync failed for '{}': {}", otdsUserId, otdsEx.getMessage());
                    result = new java.util.HashMap<>(result);
                    result.put("otdsWarning", "OTDS sync failed: " + otdsEx.getMessage());
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Fetch office_type and department_short_code_multi for the given username from cms_user_profile.
     * Used by Local Admin to restrict File Number UI to their own office type and departments.
     * GET /api/users/profile-context?username=Kalai
     */
    @GetMapping("/profile-context")
    public ResponseEntity<Map<String, Object>> getProfileContext(@RequestParam String username) {
        try {
            return ResponseEntity.ok(userService.getProfileByUsername(username));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Search user profiles.
     * Optional officeTypeFilter: 'HO' → only HO users; 'RO' → non-HO users (RO/TE).
     * Optional locationFilter: filter by location field (for RO/TE Local Admin).
     * Optional deptNames: comma-separated department names (for HO Local Admin).
     */
    @GetMapping("/profiles")
    public Map<String, Object> searchUserProfiles(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String officeTypeFilter,
            @RequestParam(required = false) String locationFilter,
            @RequestParam(required = false) String deptNames,
            @RequestParam(required = false) String uin,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String deptCode,
            @RequestParam(required = false) String roCode,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir,
            @RequestParam(name = "include-total", defaultValue = "false") boolean includeTotal) {
        return userService.searchUserProfiles(query, page, size, officeTypeFilter, locationFilter, deptNames,
                uin, grade, deptCode, roCode, sortBy, sortDir, includeTotal);
    }

    /**
     * Bulk department_short_code_multi lookup keyed by r_object_id. Used by the User Data
     * Export feature to expand multi-department users into one export row per department.
     * GET /api/users/dept-multi?officeTypeFilter=RO
     */
    @GetMapping("/dept-multi")
    public Map<String, List<String>> getDeptMulti(@RequestParam(required = false) String officeTypeFilter) {
        return userService.getDeptMultiByOfficeType(officeTypeFilter);
    }

    /**
     * Profiles of all members of a role group, across all office types.
     * role = localAdmin (ecm_local_admin) | cgmSect (any ecm_*cgm_sec group).
     */
    @GetMapping("/role-members")
    public ResponseEntity<Map<String, Object>> getRoleMemberProfiles(
            @RequestParam String role,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "500") int size) {
        try {
            return ResponseEntity.ok(userService.getRoleMemberProfiles(role, page, size));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create a new dm_user
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(userService.createUser(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Create a cms_user_profile object in /UserProfile/UsersProfileBO.
     * POST /api/users/profile
     */
    @PostMapping("/profile")
    public ResponseEntity<Map<String, Object>> createUserProfile(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(userService.createCmsUserProfile(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * OTDS post-creation setup: creates OTDS user, adds to partition, sets initial password.
     * POST /api/users/otds/setup
     */
    @PostMapping("/otds/setup")
    public ResponseEntity<Map<String, Object>> setupOtdsUser(@RequestBody Map<String, Object> req) {
        String loginName   = (String) req.get("loginName");
        String displayName = (String) req.getOrDefault("displayName", loginName);
        String email       = (String) req.getOrDefault("email", "");
        String password    = (String) req.get("password");
        String partition   = (String) req.getOrDefault("partition", "DCTMPartitions");
        boolean reqChange  = Boolean.TRUE.equals(req.get("requirePasswordChange"));
        try {
            otdsService.setupNewOtdsUser(loginName, displayName, email, password, partition, reqChange);
            return ResponseEntity.ok(Map.of("success", true, "message", "OTDS user provisioned successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update password for a dm_user by login name (OTDS-sourced users)
     */
    @PatchMapping("/{loginName:.+}/password")
    public ResponseEntity<Map<String, Object>> updateUserPassword(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> request) {
        String newPassword = (String) request.get("password");
        String adminUser = (String) request.get("adminUser");
        try {
            Map<String, Object> result = userService.updateUserPassword(loginName, newPassword, adminUser);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update password for an inline-password dm_user directly in Documentum (no OTDS).
     * PATCH /api/users/{loginName}/inline-password
     */
    @PatchMapping("/{loginName:.+}/inline-password")
    public ResponseEntity<Map<String, Object>> updateInlineUserPassword(
            @PathVariable String loginName,
            @RequestBody Map<String, Object> request) {
        String newPassword = (String) request.get("password");
        String adminUser = (String) request.get("adminUser");
        try {
            Map<String, Object> result = userService.updateInlineUserPassword(loginName, newPassword, adminUser);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Check if a UIN already exists in cms_user_profile.
     * GET /api/users/check-uin?uin=3405
     */
    @GetMapping("/check-uin")
    public Map<String, Object> checkUinExists(@RequestParam String uin) {
        return userService.checkUinExists(uin);
    }

    /**
     * Get a single user profile by object ID (returns all properties including repeating attrs).
     * GET /api/users/profiles/{objectId}
     */
    @GetMapping("/profiles/{objectId}")
    public ResponseEntity<Map<String, Object>> getProfileById(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(userService.getProfileById(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update user profile
     */
    @PatchMapping("/profiles/{objectId}")
    public Map<String, Object> updateUserProfile(
            @PathVariable String objectId,
            @RequestBody Map<String, Object> properties) {
        return userService.updateUserProfile(objectId, properties);
    }
}
