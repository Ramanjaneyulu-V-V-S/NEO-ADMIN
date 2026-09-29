// Grid column field → API parameter name mapping
export const FILTER_FIELD_MAP = {
  digidak_uid: "uid_number",
  subject: "subject",
  isForwardLetter: "is_forward_letter",
  completion_date: "completion_date",
  due_date: "due_date",
  to: ["region", "received_from"],
  status: "inp_status",
  category: "type_category",
  language: "languages",
  login_region: "login_region",
  secrecy: "secrecy",
  endorse_uid: "endorse_uid",
  responding_uid: "responding_uid",
  office_order_no: "office_order_no",
};

// Text fields get debounced; dropdown fields fire immediately
export const TEXT_FILTER_FIELDS = new Set(["digidak_uid", "subject", "to", "login_region", "endorse_uid", "responding_uid", "office_order_no"]);
export const DATE_FILTER_FIELDS = new Set(["completion_date", "due_date"]);

// Strip column-filter API keys from a payload so they can be replaced
const FILTER_API_KEYS = new Set(Object.values(FILTER_FIELD_MAP).flat());
export const stripFilterParams = (payload) => {
  if (!payload) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !FILTER_API_KEYS.has(key)));
};

// Default form values for react-hook-form
export const defaultValues = {
  digidakUID: "",
  subject: "",
  fromDate: null,
  toDate: null,
  srcVerticalId: "",
  status: "",
  category: "",
  to: "",
  language: "",
};
