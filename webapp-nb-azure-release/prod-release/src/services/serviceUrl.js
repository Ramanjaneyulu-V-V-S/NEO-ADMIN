export class ServiceUrl {
  // login & user profile api
  static userProfile = `/realtime-queries/cms_get_userprofile`;
  static updateUserProfile = `/processes/cms_update_user_profile`;

  // dashboard screen api's
  static getDepartments = `/dql-queries/cms_get_folder_objects_`;
  static getAllCases = `/realtime-queries/cms_get_all_cases`;
  static getDashboardVerticals = `/processes/cms_get_verticals_based_on_users`;

  // create case screen api's
  static getFileNumbers = `/realtime-queries/cms_get_file_number`;
  static createNotesheet = `/processes/cms_create_notesheet_from_inline_editor`;
  static getFilePath = `/files`;
  static uploadDocument = (id) => `/folders/dm_folder/${id}/objects`;
  static createCase = `/processes/cms_create_case`;
  static renderSupporting = `/processes/cms_render_supporting_d`;

  //notesheet preview
  static notesheetPreview = `/custom/notesheet_preview`;

  // case inbox
  static getInboxCases = `/tasklist-queries/cms_inbox`;

  // get sent cases
  static getOutboxCases = `/dql-queries/cms_sent_task`;
  static getOutboxCasesV2 = `/Integration/api/queries/execute`;

  // movement register
  static getNotesheetId = `/dql-queries/cms_get_case_note_docum`;
  static refreshNotesheet = `/processes/cms_refresh_notesheet`;

  // get & add case details
  static caseDetails = (folderId) => `/folders/cms_case_folder/${folderId}`;
  static buttonCondition = `/processes/cms_get_grades?id=processes%2Fcms_get_grades%2Fcms_get_grades_initiate_staless_ds_outputs-5`;
  static getWFId = `processes/cms_get_wfid_and_queueitemid`;

  // reference cases
  static getReferenceCases = `realtime-queries/cms_get_reference_cases`;
  static selectReferenceCases = `realtime-queries/cms_select_reference_ca`;

  // movement register
  static getMovementRegister = `realtime-queries/cms_get_movement_regist`;

  // draft & supporting docs
  static getDraftSupportingDoc = `dql-queries/cms_get_case_supporting`;
  static deleteDraftSupportingDoc = `/processes/cms_delete_document`;
  static updateFinalDocument = `/processes/cms_update_final_document`;

  static addVersionDraftDoc = (id) => `/contents/cms_supporting_document/${id}/versions?version-policy=next-major`;

  // download document
  static downloadDocument = (documentId) => `/contents/cms_supporting_document/${documentId}/media`;

  // download notesheet
  static downloadNotesheet = (note_sheet_id) => `/contents/cms_note_document/${note_sheet_id}/media`;

  // workflow
  static initiateLinearProcess = `/processes/cms_linear_process`;

  // push back & pull back
  static pushPullBackStatus = `/processes/cms_push_back_pull_back`;

  // resubmit
  static resubmitCase = `/processes/cms_resubmit_case`;

  // get user
  static getUsers = `/dql-queries/cms_get_users`;
  static getUserNames = `/processes/cms_get_users`;

  // get user
  static getGrade = `/processes/cms_get_grades?page=1&start=0&items-per-page=100`;
  static getAllGradeUsers = `/dql-queries/cms_get_users_from_allo`;

  // get groups
  static getGroups = `/processes/cms_get_groups_for_logged_in_user_by_designation?page=1&start=0&items-per-page=100`;

  //IV
  static callPublishIvService = `/processes/cms_call_publish_iv_service`;

  //notification
  static getSelectedUser = `/processes/cms_send_notification`;
  static getNotification = `/realtime-queries/cms_get_notifications?inline=true`;
  static updateNotificationPreferences = `/business-objects/cms_user_profile`;
  static updateReadStatus = `/processes/cms_update_isread_for_notification`;

  static caseMovementRegis = () => `/realtime-queries/cms_case_movement_regis`;

  static cmsTaskName = `/processes/cms_set_task_name`;
  static userVerticalDepartmentPart = `/processes/cms_is_given_user_part_`;
  static isUserVerticalDepartmentPart = `/processes/cms_check_input_user_part_of_input_vertical_or_department`;
  static getBackwardPerformers = `/processes/cms_get_backward_performers?include-lwso=true&page=1&start=0&items-per-page=100`;

  //search case
  static searchInDoc = `/dql-queries/cms_full_text_search`;

  // circulars
  static getCirculars = `/realtime-queries/cms_get_circular_docume`;
  static getFavouriteCirculars = `/dql-queries/cms_get_user_favourite_`;
  static favouriteCirculars = `/processes/cms_create_circulars_favourites`;

  // digidak dashboard counts
  // static getDigidakDashboardCounts = `/processes/cms_digidak_dashboard`;
  static getDigidakDashboardCounts = `/processes/cms_digidak_chairman_da`;

  // Digidak Inward APIs
  static getDigidakDropdown = (input) => `/realtime-queries/cms_digidak_get_metadat?inline=true&input_input=${input}&page=1&start=0&items-per-page=100`;
  static createDigidakInward = `/processes/cms_digidak_creation?id=processes%2Fcms_digidak_creation%2Fcms_digidak_creation_initiate_staless_ds_outputs-6`;
  static getDigidakInwardGridData = `/realtime-queries/cms_digidak_get_folder`;
  static provideDigidakPermission = `/processes/cms_digidak_provide_permission`;

  static updateDocumentsType = `/contents/cms_digidak_document`;
  static getInwardDocuments = `/realtime-queries/cms_digidak_get_documen`;

  // Digidak Inbox APIs
  static getDigidakGroups = `/processes/cms_digidak_get_groups?include-lwso=true&page=1&start=0&items-per-page=100`;
  static getDigidakInbox = `/dql-queries/cms_digidak_inbox?inline=true`;
  static getDigidakInboxV2 = `/Integration/api/queries/execute`;
  static getLetterBoxData = `/dql-queries/cms_digidak_personal_le`;

  // Digidak Outbox APIs
  static getDigidakOutboxV2 = `/Integration/api/queries/execute`;

  // Digidak Correspondence APIs
  static updateDigidakFolderStatus = (folderId) => `/folders/cms_digidak_folder/${folderId}`;
  static getDigidakVerticalHeadGroups = `/processes/cms_digidak_get_groups?page=1&start=0&items-per-page=100`;
  static getDigidakVerticalUsers = `/processes/cms_digidak_get_groups`;
  static getDigidakSourceVertical = `/processes/cms_digidak_get_groups?include-lwso=true&page=1&start=0&items-per-page=100`;

  // movement register
  static getDigidakMovementRegister = `realtime-queries/cms_digidak_get_movemen`;

  // Digidak Outward APIs
  static createDigidakOutward = `/processes/cms_digidak_creation?id=processes%2Fcms_digidak_creation%2Fcms_digidak_creation_initiate_staless_ds_outputs-3`;
  static provideDigidakOutwardPermission = `/processes/cms_digidak_provide_permission`;
  static getSelectedRecipientsCombined = `/processes/cms_digidak_get_selected_recipients_combined`;
  static getEndorseSequence = `/processes/cms_digidak_create_endorse_sequence`;

  // Digidak Draft
  static getDigidakDraft = "realtime-queries/cms_digidak_get_folder";
  static getDigidakOneFolder = "folders/cms_digidak_folder";

  // Digidak Old Letters
  static getOldLettersOutbox = "/dql-queries/cms_digidak_migration";
  static getOldLettersInbox = "/dql-queries/cms_digidak_migration_i";
  static getOldLettersMigrationV2 = `/Integration/api/queries/execute`;
}
