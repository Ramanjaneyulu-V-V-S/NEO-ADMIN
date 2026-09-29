import { createOptions } from "../../utils/Utils";

export const sixGroups = ["DMD S1 EA", "DMD S2 EA", "CHAIRMAN EA", "DMD S1", "DMD S2", "CHAIRMAN"];
export const GROUPS_EA = ["DMD S1 EA", "DMD S2 EA", "CHAIRMAN EA"];
export const GROUPS_MAIN = ["DMD S1", "DMD S2", "CHAIRMAN"];
export const DMD_DESIGNATION = ["DMD S1", "DMD S2"];

export const casePriority = createOptions(["Ordinary", "Urgent"]);
export const natureOfCase = createOptions(["Confidential", "Regular", "Secret"]);
export const languages = createOptions(["Bilingual", "English", "Hindi", "Others"]);

// Filter dropdown options (plain arrays for grid column filters)
export const casePriorityOptions = ["Ordinary", "Urgent"];
export const taskNameOptions = ["EA", "Review", "Routing"];
export const referenceCaseStatusOptions = ["Approved", "Closed"];
export const digidakCategoryOptions = ["Actionable", "Information"];
export const approveDesignation = ["grade_c", "grade_d", "grade_e", "grade_e(oic)", "grade_f", "DMD", "CHAIRMAN"];
export const natureOfCaseOptions = ["Confidential", "Regular", "Secret"];
export const caseLanguageOptions = ["Bilingual", "English", "Hindi", "Others"];
export const oldLettersSecrecyOptions = ["Confidential", "Secret", "Internal", "Public"];
export const caseStatusOptions = ["Approved", "Cancelled", "Closed", "Draft", "In-Progress"];
export const digidakStatusOptions = ["Assigned", "Assigned Head", "Closed", "Follow Up", "Inprocess", "Opened", "Reassign Head", "Reassigned", "Responded", "Saved", "Unread"];

// Digidak dashboard status constants (used in Digidak ChartSection and ViewLetters)
export const DIGIDAK_ISSUED_STATUSES_ALL = "Assigned,Assigned Head,Closed,Follow-Up,Inprocess,Opened,Pushback,Reassign Head,Reassigned,Responded,Unread";
export const DIGIDAK_ISSUED_STATUSES_PENDING = "Assigned,Assigned Head,Follow-Up,Inprocess,Opened,Pushback,Reassign Head,Reassigned,Unread";
export const DIGIDAK_ISSUED_STATUSES_RESPONDED = "Responded";
export const DIGIDAK_RECEIVED_STATUSES_WITH_CLOSED = "Assigned,Assigned Head,Closed,Follow-Up,Inprocess,Opened,Pushback,Reassign Head,Reassigned,Responded,Unread";
export const DIGIDAK_RECEIVED_STATUSES_ALL = "Assigned,Assigned Head,Follow-Up,Inprocess,Opened,Pushback,Reassign Head,Reassigned,Responded,Unread";
export const DIGIDAK_RECEIVED_STATUSES_INFO = "Assigned,Assigned Head,Closed,Opened,Reassign Head,Reassigned,Unread";
export const DIGIDAK_RECEIVED_STATUSES_ACTION = "Assigned,Assigned Head,Inprocess,Opened,Reassign Head,Reassigned,Unread";
export const DIGIDAK_RECEIVED_STATUSES_FOLLOWUP = "Follow-Up";
export const DIGIDAK_RECEIVED_STATUSES_MONTH = "Assigned,Assigned Head,Inprocess,Opened,Pushback,Reassign Head,Reassigned,Unread";

export const INTERNAL_EXTERNAL_OPTIONS = [
  { text: "Internal", value: "Internal" },
  { text: "External", value: "External" },
];

export const LANGUAGE_OPTIONS = [
  { text: "English", value: "English" },
  { text: "Hindi", value: "Hindi" },
];

/* Digidak Dropdown Data*/
export const typeData = createOptions(["External", "Internal"]);
export const categoryData = createOptions(["Actionable", "Information"]);
export const priorityData = createOptions(["Immediate", "Normal", "Urgent"]);
export const disposalLevels = createOptions(["Chairman", "DMD", "CGM", "GM", "DGM", "AGM"]);
export const getDisposalLevels = (officeType) => (officeType === "HO" ? disposalLevels : disposalLevels.filter((item) => item.text !== "Chairman" && item.text !== "DMD"));
export const natureCorrespondenceData = createOptions(["Circulars", "Do Letter", "IDM", "IOM", "Invoice", "Letter", "Others", "Purchase order"]);

export const officeTypeOptions = [
  { label: "HO", value: "HO" },
  { label: "RO", value: "RO" },
  { label: "TE", value: "TE" },
];

export const options = [
  { label: "View All Cases", value: "allCase" },
  { label: "Select RO/TE", value: "roteDept" },
  { label: "Select HO Dept", value: "hoDept" },
];

export const performerNameByDepartment = {
  chmns: "Shaji K V",
  dmds1: "Goverdhan Singh Rawat",
  dmds2: "Ajay K Sood",
};

export const teOptions = [
  { text: "Bird Kolkata", value: "bk" },
  { text: "Bird Lucknow", value: "bl" },
  { text: "Bird Mangalore", value: "bm" },
  { text: "NBSC Lucknow", value: "nc" },
];

export const teDataList = ["Bird Kolkata", "Bird Lucknow", "Bird Mangalore", "NBSC Lucknow"];
