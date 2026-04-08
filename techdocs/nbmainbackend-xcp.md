# xCP Main Backend — Case Management System

> **Location:** `nbmainbackend/Case_Management_System/`
> **Version:** 1.0.0 (Build: 2026-01-15)
> **Platform:** xCP 24.2.0 (Documentum xCelerated Composition Platform)
> **Packaging:** WAR + DAR
> **Repository:** NABARDUAT

---

## 1. Overview

The Case Management System (`cms`) is the core xCP enterprise application for NABARD. It manages the full lifecycle of cases, digital files (Digidak), workflows, notesheets, and permissions. The NBSupportApp support portal was built to administer this system.

**At a Glance:** 47 processes, 8 business objects, 4 content types, 2 folder types, 30 queries, 9 action flows, 11 UI pages, 8 Java modules, 3 endpoints, 3 permission sets.

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Platform | xCP 24.2.0 |
| ECM | Documentum Content Server |
| Language | Java 1.8 |
| Framework | Spring Framework + Spring Security |
| Build | Maven 3.x with xCP plugins |
| Viewer | OpenText Brava v24.2.0 |
| Workflows | BPMN 2.0 |
| Cache | EHCache |

---

## 2. Project Structure

```
Case_Management_System/
├── pom.xml                          # Maven build (xCP 24.2 plugins)
├── Artifacts/                       # xCP design-time artifacts
│   ├── Action Flows/ (9)            # UI action flows for linear workflow
│   ├── Business Objects/ (8)        # TBO definitions
│   ├── Content/ (4)                 # Document types
│   ├── Dql Queries/ (13)            # DQL query definitions
│   ├── Email Templates/ (1)         # case_details template
│   ├── Endpoints/ (3)               # repo, smtp, iv
│   ├── Folders/ (2)                 # cms_case_folder, cms_digidak_folder
│   ├── Java Modules/ (8)            # Custom Java extensions
│   ├── Pages/ (11)                  # Application UI pages
│   ├── Parameters/ (7)              # Runtime config params
│   ├── Permission Sets/ (3)         # ACL definitions
│   ├── Processes/ (47)              # BPMN workflow definitions
│   ├── Real-time Queries/ (14)      # Search definitions
│   ├── Relationships/ (1)           # circulars <-> user_profile
│   └── Task-list Queries/ (3)       # inbox, allinbox, sent_cases
├── content/                         # Pre-packaged JARs (modules + libs)
├── gen/main/resources/types/        # Generated JSON type definitions
├── src/main/
│   ├── resources/                   # Config, logging, JDBC
│   └── webapp/                      # JSPs, web.xml, JS
└── META-INF/                        # Bundle manifest
```

---

## 3. Data Model

### Folder Types

**cms_case_folder** (27 attributes, extends dm_folder)

| Category | Attributes |
|----------|-----------|
| Identity | `file_number`, `types`, `status` (default: Draft), `years` |
| Organization | `department_name`, `department_short_code`, `function_short_code`, `functions`, `ho_ro` |
| Properties | `case_nature`, `description`, `location`, `task_priority`, `language_type`, `disposal_level` |
| Control | `in_workflow` (bool), `is_resubmitted`, `is_migrated`, `resubmitted_sequence_number` |
| Reference | `reference_cases` (repeating) |
| Legacy | `fams_clmas_serial_number`, `fams_clmas_date`, `migrated_id` |

**cms_digidak_folder** (38+ attributes, extends dm_folder)

| Category | Attributes |
|----------|-----------|
| Entry | `entry_type`, `entry_date`, `received_from`, `state_of_sender`, `address_of_sender` |
| Document | `letter_subject`, `letter_no`, `inward_ref_number`, `mode_of_receipt` |
| Classification | `type_category`, `priority`, `secrecy`, `languages`, `nature_of_correspondence` |
| Workflow | `decision`, `status`, `uid_number`, `due_date`, `financial_year` |
| Groups | `vertical`, `vertical_head`, `vertical_users` (repeating), `workflow_groups` (repeating) |

### Business Objects (8)

| Object | Purpose |
|--------|---------|
| `auto_number_config` | Auto-numbering sequences |
| `digidak_metadata` | Digidak letter metadata (region, short_codes) |
| `digidak_movement_re` | Digidak movement tracking |
| `file_number` | Sequential file numbering |
| `movement_register` | Case movement tracking (assigned_user, assigned_performer) |
| `notification` | System notifications |
| `user_profile` | User settings, departments, verticals, favorites |
| `workflow_param` | Workflow state (action, case_status, department, performer, task_name) |

### Content Types (4, extend dm_document)

| Type | Purpose |
|------|---------|
| `cms_circulars` | Organizational circulars and memos |
| `cms_digidak_document` | Official correspondence (scanned/uploaded) |
| `cms_note_document` | Internal notesheets/comments |
| `cms_supporting_document` | Case attachments and evidence |

### Permission Sets (ACLs)

| Set | dm_world | dm_owner |
|-----|----------|----------|
| `case_acl` | None | Delete + Execute Proc + Change Permit/Owner/State |
| `digidak_acl` | None | Full rights |
| `notificationacl` | Read | Full rights |

---

## 4. Workflows & Processes (47)

### Case Management

| Process | Purpose |
|---------|---------|
| `create_case` | Initiate new case with file numbering, ACL, vertical assignment |
| `linear_process` | Primary workflow: Route -> Review -> EA -> Complete |
| `resubmit_case` | Case resubmission after rejection |
| `push_back_pull_back` | Return case for further action |
| `generate_case_movement_slip` | Movement slip generation |
| `delete_document` | Document deletion workflow |
| `update_final_document` | Final document update on completion |

### Linear Process Stages

Route -> Review -> EA -> Complete (with push-back at each stage). 9 action flows map to the stages: `linear_process_rout`, `linear_process_revi`, `linear_process_manu`, plus RO/RE/MA variants.

### Digidak Processes (14)

| Process | Purpose |
|---------|---------|
| `digidak_creation` | Create new letter |
| `digidak_create_endorse_sequence` | Multi-signatory endorsement |
| `digidak_get_groups` | Fetch recipient groups |
| `digidak_provide_permission` | Set access permissions |
| `digidak_mail` | Email notification |
| `digidak_secrecy` | Confidential classification |
| `digidak_copy_documents_from_main_letter` | Attach/reference docs |
| `digidak_dashboard` | Dashboard data preparation |

### Notesheet Processes

| Process | Purpose |
|---------|---------|
| `create_notesheet_from_inline_editor` | Create notation inline |
| `merge_notesheet_template` | Merge templates |
| `refresh_notesheet` | Refresh content |

### Permission Processes

| Process | Purpose |
|---------|---------|
| `assign_workflow_level_permission` | Dynamic permission during workflow |
| `provide_read_permission_to_vertical` | Cross-vertical read access |
| `revoke_other_vertic` / `revoke_other_dept_ro_permission` | Revoke access |
| `check_input_user_part_of_input_vertical_or_department` | User validation |

### Utility Processes

`get_next_case_number`, `get_users`, `get_grades`, `get_groups_for_logged_in_user_by_designation`, `get_verticals_based_on_users`, `send_email`, `send_notification`, `update_isread_for_notification`, `call_publish_iv_service`, `update_user_profile`

---

## 5. Queries & Searches (30)

### DQL Queries (13)

`full_text_search`, `digidak_inbox`, `digidak_outbox`, `digidak_dashboard_i/o`, `get_groups`, `get_users_from_allo`, `get_case_note_docum`, `get_case_supporting`, `get_department_name`, `get_folder_objects_`, `get_user_favourite_`

### Real-time Queries (14)

`get_all_cases`, `get_notifications`, `get_file_number`, `get_note_documents`, `get_movement_regist`, `get_circular_docume`, `get_userprofile`, `get_reference_cases`, `select_reference_ca`, `case_movement_regis`, `digidak_get_documen`, `digidak_get_folder`, `digidak_get_metadat`, `digidak_get_movemen`

### Task-list Queries (3)

`inbox` (user's pending tasks), `allinbox` (all available tasks), `sent_cases` (routed by user)

---

## 6. Java Modules (8)

| Module | Key Classes | Purpose |
|--------|------------|---------|
| **ecm_functions** | ECMFunction, NoteSheet, GroupOperations, WorkflowUtilities, UpdateACL, IVService, CustomController | Core business logic, REST, IV integration |
| **digidak** | DigidakFunction (+ Aspose.Cells) | Digidak letter management |
| **notesheet** | Notesheet creation (+ Aspose.Words) | Word document generation |
| **notesheet_inline_ed** | Inline editor | Browser-based notesheet editing |
| **permission** | ACL management | Dynamic permission assignment |
| **groupoperation** | Group hierarchy | Group membership, LDAP |
| **publish_iv** | IV publishing | Document rendering via Brava |
| **push_back** | Case reversal | Workflow push-back logic |

### External Libraries

| Library | JARs | Purpose |
|---------|------|---------|
| httpextensions | httpclient-4.5.14, httpclient5-5.3.1 | REST/HTTP integration |
| json | json-20231013 | JSON processing |
| sl4j | slf4j-api-1.7.36, slf4j-reload4j-2.0.7 | Logging |

---

## 7. Integrations

| Endpoint | Detail |
|----------|--------|
| **repo** | DocBroker: 172.172.20.214, Repository: NABARDUAT, Auth: Encrypted |
| **smtp** | smtp.office365.com:587 (TLS), From: support.ecm@nabard.org |
| **iv** | OpenText Brava v24.2.0 for document viewing and annotation |

### Security Model

- **Authentication:** Spring Security + Documentum DFC + OTDS SSO
- **Authorization:** ACL-based (case_acl, digidak_acl) + workflow-level permissions + vertical/department isolation
- **Session:** 480 minutes (8 hours), 2GB max upload

---

## 8. Configuration

### Runtime Parameters (7)

| Parameter | Purpose |
|-----------|---------|
| `casefolderpath` | Root path for case folders |
| `configcabinetpath` | Configuration cabinet location |
| `digidakfolderpath` | Root path for Digidak folders |
| `iv_download_url` / `iv_publish_url` | Intelligent Viewer endpoints |
| `support_mail` | Support email contact |

### Web Configuration

- **Filters (9):** Compressing, CORS, Encoding (UTF-8), Cache, Repository, HTTP Security, Spring Security, HTTP Method, Locale
- **Servlets:** DispatcherServlet (Spring MVC), ComponentServlet (xCP), InvalidateCache (BPM)
- **Session:** 480 min timeout, 2GB upload limit

---

## 9. NBSupportApp Mapping

| NBSupportApp Feature | xCP Object Type | xCP Processes |
|---------------------|----------------|---------------|
| Case Management | `cms_case_folder` | create_case, linear_process, resubmit_case, push_back_pull_back |
| User Management | `cms_user_profile` + `dm_user` | update_user_profile, get_users |
| Group Management | `dm_group` | get_groups, groupoperation module |
| Workflow Monitoring | `cms_workflow_param` | All 47 processes |
| Metadata Config | `cms_file_number`, `cms_auto_number_config` | get_next_case_number |
| DQL Query | Any type | Raw DQL via dctm-rest |
| Inbox / Tasks | dm_queue | inbox, allinbox, sent_cases |
| Delegation | `cms_movement_register` | generate_case_movement_slip |
| Notifications | `cms_notification` | send_notification, update_isread_for_notification |
