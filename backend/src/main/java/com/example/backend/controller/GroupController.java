package com.example.backend.controller;

import com.example.backend.service.GroupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    /**
     * Create a new dm_group (vertical)
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createGroup(@RequestBody Map<String, Object> request) {
        String groupName        = (String) request.get("group_name");
        String groupDisplayName = (String) request.get("group_display_name");
        Map<String, Object> result = groupService.createGroup(groupName, groupDisplayName);

        // Check if group already exists
        if (result.containsKey("exists") && (Boolean) result.get("exists")) {
            return ResponseEntity.status(409).body(result); // 409 Conflict
        }

        // Check if creation failed
        if (!((Boolean) result.getOrDefault("success", false))) {
            return ResponseEntity.status(400).body(result); // 400 Bad Request
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Search groups with optional group name filter
     */
    @GetMapping("/search")
    public Map<String, Object> searchGroups(
            @RequestParam(required = false) String groupName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return groupService.searchGroups(groupName, page, size);
    }

    /**
     * Get detailed information about a specific group including available actions
     */
    @GetMapping("/{groupName}")
    public Map<String, Object> getGroupDetails(@PathVariable String groupName) {
        return groupService.getGroupDetails(groupName);
    }

    /**
     * Get members of a specific group
     */
    @GetMapping("/{groupName}/members")
    public Map<String, Object> getGroupMembers(@PathVariable String groupName) {
        return groupService.getGroupMembers(groupName);
    }

    /**
     * Add member(s) to a group
     */
    @PostMapping("/{groupName}/members")
    public Map<String, Object> addMember(
            @PathVariable String groupName,
            @RequestBody Map<String, Object> request) {
        String memberName = (String) request.get("memberName");
        String memberType = (String) request.get("memberType"); // "user" or "group"
        String memberSrc = (String) request.get("memberSrc"); // src link to the member
        return groupService.addMember(groupName, memberName, memberType, memberSrc);
    }

    /**
     * Remove member from a group
     */
    @DeleteMapping("/{groupName}/members/{memberName}")
    public Map<String, Object> removeMember(
            @PathVariable String groupName,
            @PathVariable String memberName,
            @RequestParam(defaultValue = "user") String memberType) {
        return groupService.removeMember(groupName, memberName, memberType);
    }

    /**
     * Search dm_groups by name prefix using DQL.
     * GET /api/groups/by-prefix?prefix=ecm_ho_ddsi&size=50
     */
    @GetMapping("/by-prefix")
    public List<Map<String, String>> searchGroupsByPrefix(
            @RequestParam String prefix,
            @RequestParam(defaultValue = "50") int size) {
        return groupService.searchGroupsByPrefix(prefix, size);
    }

    /**
     * Lists verticals (with their full display name) for an HO department, sourced from
     * the dm_folder shadow objects under /ECM CONFIG/Office Type/HO/<deptName>.
     * GET /api/groups/vertical-folders?deptName=Digital Initiatives
     */
    @GetMapping("/vertical-folders")
    public List<Map<String, String>> listVerticalFolders(@RequestParam String deptName) {
        return groupService.listVerticalFolders(deptName);
    }

    /**
     * Get all groups a user belongs to.
     * GET /api/groups/by-user?username=xxx
     */
    @GetMapping("/by-user")
    public List<Map<String, String>> getGroupsByUser(@RequestParam String username) {
        return groupService.getGroupsByUser(username);
    }

    /**
     * Get verticals from ECM CONFIG folders for dropdown.
     * Queries dm_folder objects instead of dm_group.
     * GET /api/groups/verticals?officeType=HO&deptName=DDSI
     */
    @GetMapping("/verticals")
    public List<Map<String, String>> getVerticalFolders(
            @RequestParam String officeType,
            @RequestParam String deptName) {
        return groupService.getVerticalFolders(officeType, deptName);
    }

    /**
     * Check whether a dm_group with the given name exists.
     * GET /api/groups/exists/{groupName}
     */
    @GetMapping("/exists/{groupName}")
    public Map<String, Object> checkGroupExists(@PathVariable String groupName) {
        return groupService.checkGroupExists(groupName);
    }

    /**
     * Create a dm_folder for a vertical under the HO department folder.
     * POST /api/groups/vertical-folder
     */
    @PostMapping("/vertical-folder")
    public ResponseEntity<Map<String, Object>> createVerticalFolder(@RequestBody Map<String, Object> request) {
        String verticalFullName  = (String) request.get("verticalFullName");
        String verticalShortcode = (String) request.get("verticalShortcode");
        String groupName         = (String) request.get("groupName");
        String deptName          = (String) request.get("deptName");
        try {
            return ResponseEntity.ok(groupService.createVerticalFolder(verticalFullName, verticalShortcode, groupName, deptName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Update the group_display_name of a dm_group.
     * PUT /api/groups/{groupName}/display-name
     */
    @PutMapping("/{groupName}/display-name")
    public ResponseEntity<Map<String, Object>> updateGroupDisplayName(
            @PathVariable String groupName,
            @RequestBody Map<String, Object> request) {
        String newDisplayName = (String) request.get("displayName");
        try {
            return ResponseEntity.ok(groupService.updateGroupDisplayName(groupName, newDisplayName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Search for users or groups to add as members
     */
    @GetMapping("/search-members")
    public Map<String, Object> searchMembers(
            @RequestParam String query,
            @RequestParam(defaultValue = "user") String type) {
        return groupService.searchMembers(query, type);
    }
}
