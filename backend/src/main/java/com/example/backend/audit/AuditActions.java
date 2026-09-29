package com.example.backend.audit;

import java.util.Map;

/**
 * Maps a matched controller handler ({@code SimpleClassName#methodName}) to a
 * human-readable action label for the audit log. Any write endpoint not listed
 * here still gets audited — {@link AuditLogInterceptor} falls back to
 * {@code <VERB> <last-path-segment>}.
 */
final class AuditActions {

    private AuditActions() {}

    static final Map<String, String> LABELS = Map.ofEntries(
            // ─── Users ───────────────────────────────────────────────
            Map.entry("UserController#createUser",                    "Create user"),
            Map.entry("UserController#createUserProfile",             "Create user profile"),
            Map.entry("UserController#updateUserProfile",             "Update user profile"),
            Map.entry("UserController#updateDmUser",                  "Update user (dm_user)"),
            Map.entry("UserController#updateUserPassword",            "Reset user password"),
            Map.entry("UserController#updateInlineUserPassword",      "Reset user password (inline)"),
            Map.entry("UserController#setupOtdsUser",                 "Provision OTDS account"),
            Map.entry("UserController#addVerticalIdToProfile",        "Add vertical to user profile"),
            Map.entry("UserController#removeVerticalIdFromProfile",   "Remove vertical from user profile"),

            // ─── Groups ──────────────────────────────────────────────
            Map.entry("GroupController#createGroup",                  "Create group"),
            Map.entry("GroupController#addMember",                    "Add group member"),
            Map.entry("GroupController#removeMember",                 "Remove group member"),
            Map.entry("GroupController#createVerticalFolder",         "Create vertical folder"),
            Map.entry("GroupController#updateGroupDisplayName",       "Update group display name"),

            // ─── Metadata ────────────────────────────────────────────
            Map.entry("MetadataController#createFileNumber",          "Create file number"),
            Map.entry("MetadataController#updateFileNumber",          "Update file number"),
            Map.entry("MetadataController#deleteFileNumber",          "Delete file number"),
            Map.entry("MetadataController#createDigidakMetadata",     "Create Digidak metadata"),
            Map.entry("MetadataController#updateDigidakMetadata",     "Update Digidak metadata"),
            Map.entry("MetadataController#deleteDigidakMetadata",     "Delete Digidak metadata"),
            Map.entry("MetadataController#createCaseType",            "Create case type"),
            Map.entry("MetadataController#createHindiComment",        "Create Hindi comment"),

            // ─── SFS ─────────────────────────────────────────────────
            Map.entry("SfsController#createDocumentType",             "Create SFS document type"),
            Map.entry("SfsController#updateDocumentType",             "Update SFS document type"),
            Map.entry("SfsController#deleteDocumentType",             "Delete SFS document type"),
            Map.entry("SfsController#createDocumentCategory",         "Create SFS document category"),
            Map.entry("SfsController#updateDocumentCategory",         "Update SFS document category"),
            Map.entry("SfsController#deleteDocumentCategory",         "Delete SFS document category"),
            Map.entry("SfsUserAccessController#addUserToGroup",       "Add user to SFS access group"),

            // ─── Departments ─────────────────────────────────────────
            Map.entry("DepartmentController#createDepartment",        "Create department"),

            // ─── Workflows ───────────────────────────────────────────
            Map.entry("WorkflowController#restartWorkflow",           "Restart workflow"),
            Map.entry("WorkflowController#retryActivity",             "Retry workflow activity"),
            Map.entry("IvController#publishToIv",                     "Republish document to IV"),

            // ─── Cases ───────────────────────────────────────────────
            Map.entry("DelegateController#delegateCase",              "Delegate case"),

            // ─── Query ───────────────────────────────────────────────
            Map.entry("QueryController#executeQuery",                 "Execute DQL query"),

            // ─── Reports / exports (server-generated) ────────────────
            Map.entry("RajbhashaController#exportRajbhashaReport",    "Export Rajbhasha report")
    );

    /** Handler keys whose GET should be audited (report/export downloads). */
    static final java.util.Set<String> AUDITED_GETS = java.util.Set.of(
            "RajbhashaController#exportRajbhashaReport"
    );
}
