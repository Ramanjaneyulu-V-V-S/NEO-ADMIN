export const mapResponseToLetterFields = (data, dropdownData) => {
  const loginOfficeType = data?.login_office_type;
  const loginRegion = data?.login_region;
  const entryType = data?.entry_type;

  const isExternal = entryType === "External";
  const isDDMLetter = data?.is_ddm === true || data?.is_ddm === 1;

  const normalize = (str) => str?.toLowerCase().replace(/[\s-]/g, "") || "";

  let ro = "";
  let department = "";

  if (!isExternal) {
    if (isDDMLetter) {
      ro = { text: "DDM", value: "DDM" };
      department = "";
    } else {
      ro = loginOfficeType ? { text: loginOfficeType, value: loginOfficeType } : "";

      const departmentsForOffice = dropdownData?.[loginOfficeType] || [];

      const matchedDept = departmentsForOffice.find((item) => normalize(item.text).startsWith(normalize(loginRegion)));

      department = matchedDept?.value || "";
    }
  }

  return {
    type: entryType,

    responseToDigidakId: data?.uid_number ? { value: data.uid_number, text: data.uid_number } : "",

    ro,
    department,

    taskCategory: "Information",

    categoryExternal: !isDDMLetter && isExternal ? data?.received_from || "" : "",

    recipientAddress: !isDDMLetter && isExternal ? data?.address_of_sender || "" : "",

    stateOfRecipient: !isDDMLetter && isExternal ? data?.state_of_sender || "" : "",
  };
};
