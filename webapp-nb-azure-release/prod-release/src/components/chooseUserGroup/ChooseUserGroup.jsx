import { useState, useEffect, useRef } from "react";

//kendo component
import { Checkbox, Input, RadioGroup } from "@progress/kendo-react-inputs";
import { DropDownList } from "@progress/kendo-react-dropdowns";

// redux
import { useSelector } from "react-redux";
import { dashboardService } from "../../services/dashboard/dashboardService";
import { viewCaseService } from "../../services/caseManagement/viewCase/ViewCaseService";
import { createCaseService } from "../../services/caseManagement/createCase/createCaseService";
import { showSweetAlert } from "../sweetAlert/SweetAlert";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { GROUPS_MAIN, sixGroups, officeTypeOptions } from "../../pages/data/DropdownData";

const option = [{ label: "Initiator", value: "Initiator" }];

const ChooseUserGroup = ({
  folderId,
  tagName,
  internal,
  interOffice,
  interDepartmental,
  backward,
  delegate,
  approveCase,
  rCreatorName,
  caseNature,
  verticalGroup = [],
  departmentGroup = [],
  onSelectionChange,
  clearAll,
  isUserExistData,
  movementRegisterData,
  departmentShortCode,
  param_department,
}) => {
  const fetchedRef = useRef(false);

  const { userProfile, dmdChairmanCondition } = useSelector((state) => state?.login);
  const { department_short_code, office_type, object_name, department_name, ro_short_code, user_grade, designation, id } = userProfile?.properties || {};

  const [userNames, setUserNames] = useState([]);

  const [regionGroup, setRegionGroup] = useState([]);
  const [interGroupName, setInterGroupName] = useState([]);
  const [departmentNames, setDepartmentNames] = useState([]);
  const [CGMGroup, setCGMGroup] = useState("");
  const [groupName, setGroupName] = useState([]);
  const [markSelector, setMarkSelector] = useState(false);
  const [initiatorName, setInitiatorName] = useState("");
  const [selectedOfficeType, setSelectedOfficeType] = useState("");
  const [userData, setUserData] = useState(null);
  const [selectedTOTE, setSelectedTOTE] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCGMDept, setSelectedCGMDept] = useState(null);
  const [selectedVertical, setSelectedVertical] = useState(null);
  const [chooseDeptFilter, setChooseDeptFilter] = useState("");
  const [chooseROTEFilter, setChooseROTEFilter] = useState("");
  const [attentionToFilter, setAttentionToFilter] = useState("");
  const [famsClmasSerialNo, setFamsClmasSerialNo] = useState("");
  const [backwardDropData, setBackwardDropData] = useState([]);
  const [famsClmasDate, setFamsClmasDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const radioOptions = [
    { label: "Secretariat", value: "internalRadio" },
    { label: "HO Dept CGM & GM", value: "dmdRadio" },
  ];

  const [selectedValue, setSelectedValue] = useState("internalRadio");

  const foundConditionMatch = sixGroups.some((group) => dmdChairmanCondition.includes(group));
  const isDMDChairmanConditionMatch = GROUPS_MAIN.includes(dmdChairmanCondition);
  const lastItemDecision = movementRegisterData?.at(-1)?.content?.properties?.decision;
  const routingItem = movementRegisterData?.filter((item) => item?.content?.properties?.decision === "Routing")?.at(-1);
  const result = routingItem ? routingItem?.content?.properties?.choosen_user : null;

  //For Approve - CGM, Internal - CGM
  const handleGetCGMUsers = async (e) => {
    setSelectedCGMDept(e.value);
    const departmentCode = e.value?.value;

    // Reset user dropdown and user info
    setSelectedUser(null);

    const params = {
      input_department_short_co: departmentCode,
      input_office_type: office_type,
      input_designation: designation,
      ...(office_type !== "HO" && { input_ro_short_code: ro_short_code }),
    };

    const response = await viewCaseService.getCGMUsers(params);

    const users =
      response?.entries?.map((entry) => ({
        text: entry?.content?.properties?.object_name,
        value: entry?.content?.properties?.object_name,
      })) || [];

    setUserNames(users);
  };
  //For Approve
  const handleSelectGroupChange = async (e) => {
    setSelectedGroup(e.value);

    // Reset user dropdown and user info
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);
  };
  //For Inter Departmental
  const handleSelectVertical = async (e) => {
    const departmentName = e.value?.value;
    setSelectedVertical(e.value); // track selected group

    // Reset user dropdown and user info
    setSelectedGroup(null);
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);

    const groups =
      office_type === "HO"
        ? {
            text: `ECM_HO_${departmentName?.toUpperCase()}_CGM_SEC`,
            value: `ecm_ho_${departmentName}_cgm_sec`,
          }
        : {
            text: `ECM_${ro_short_code.toUpperCase()}_${departmentName?.toUpperCase()}`,
            value: `ecm_${ro_short_code}_${departmentName}`,
          };

    setCGMGroup([groups]);
  };
  //For Inter office
  const handleTypeOfficeChange = async (event) => {
    setSelectedOfficeType(event.value);

    // Reset user dropdown and user info
    setSelectedTOTE(null);
    setSelectedVertical(null);
    setSelectedGroup(null);
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);

    try {
      const response = await dashboardService.getDepartments({
        input_folder: `/ECM CONFIG/Office Type/${event.value}`,
      });

      const regionGroup =
        response?.entries?.map((entry) => ({
          text: entry?.content?.properties?.object_name,
          value: entry?.content?.properties?.title,
        })) || [];

      setRegionGroup(regionGroup);
      setDepartmentNames(regionGroup);
    } catch (err) {
      console.error(err);
    }
  };
  const handleSelectRegion = async (e) => {
    const location = e.value?.text;
    setSelectedTOTE(e.value);

    // Reset user dropdown and user info
    setSelectedVertical(null);
    setSelectedGroup(null);
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);

    try {
      const response = await createCaseService.getVerticalCaseType({
        input_folder: `/ECM CONFIG/Office Type/${selectedOfficeType}/${location}`,
      });

      const department =
        response?.entries?.map((entry) => ({
          text: entry?.content?.properties?.object_name,
          value: entry?.content?.properties?.title,
        })) || [];

      setDepartmentNames(department);
    } catch (err) {
      console.error(err);
    }
  };
  const handleSelectDepartment = async (e) => {
    setSelectedVertical(e.value);

    // Reset user dropdown and user info
    setSelectedGroup(null);
    setSelectedUser(null);
    setUserNames([]);
    setUserData(null);
  };
  //For Inter office, Backward - previous performer
  const handleSelectUser = async (e) => {
    setIsLoading(true);
    const userLoginName = e?.value?.value;
    setSelectedUser(e?.value);

    try {
      const response = await viewCaseService.getUserData({
        input_name: userLoginName,
      });

      const userData =
        response?.entries?.map((entry) => ({
          uin: entry?.content?.properties?.uin,
          designation: entry?.content?.properties?.designation,
        })) || [];

      if (internal) {
        if (!isUserExistData && !foundConditionMatch) {
          showSweetAlert({
            text: "The case is being forwarded to another vertical/department/office. Since it does not belong to your vertical/department/office, case details will not be available. If required, please download the case details for your reference before forwarding.",
          });
        }
      }

      setUserData(userData);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };
  //For HO Dept CGM and GM
  const handleCGMGMUsers = async (e) => {
    setSelectedGroup("");
    setSelectedCGMDept(e.value);
    const departmentName = e.value?.text;

    // Reset user dropdown and user info
    setSelectedUser(null);

    const params = {
      input_office_type: office_type,
      input_department_name: departmentName,
      input_user_grade_: ["grade_e", "grade_e(oic)", "grade_f"],
    };

    const response = await viewCaseService.getCGMGMUsers(params);

    const users =
      response?.entries?.map((entry) => ({
        text: entry?.content?.properties?.object_name,
        value: entry?.content?.properties?.object_name,
      })) || [];

    setUserNames(users);
  };
  const handleSelectCGMGMGroupChange = async (e) => {
    setSelectedUser(null);
    setSelectedGroup(e.value);

    const params = {
      input_office_type: office_type,
      input_department_name: selectedCGMDept?.text,
      input_user_grade_: [e.value?.value],
    };

    const response = await viewCaseService.getCGMGMUsers(params);

    const users =
      response?.entries?.map((entry) => ({
        text: entry?.content?.properties?.object_name,
        value: entry?.content?.properties?.object_name,
      })) || [];

    setUserNames(users);
  };
  //Clear all dropdown data and state
  const clearAllDropdowns = () => {
    setRegionGroup([]);
    setDepartmentNames([]);
    setInterGroupName([]);
    setSelectedOfficeType("");
    setSelectedTOTE(null);
    setCGMGroup("");
    setMarkSelector(false);
    setSelectedGroup(null);
    setSelectedVertical(null);
    setSelectedCGMDept(null);
    setSelectedUser(null);
    setUserData(null);
    setInitiatorName("");
    setFamsClmasSerialNo("");
    setFamsClmasDate(null);
  };
  //Effect to clear all data and state
  useEffect(() => {
    if (clearAll) {
      clearAllDropdowns();
    }
  }, [clearAll]);
  // Notify parent component when selections change
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({
        selectedCGMDept,
        CGMGroup,
        markSelector,
        selectedTOTE,
        interGroupName,
        selectedGroup,
        selectedUser,
        selectedVertical,
        selectedOfficeType,
        userData,
        famsClmasSerialNo,
        famsClmasDate,
      });
    }
  }, [
    selectedCGMDept,
    interGroupName,
    selectedGroup,
    selectedUser,
    selectedTOTE,
    selectedVertical,
    userData,
    CGMGroup,
    markSelector,
    selectedOfficeType,
    onSelectionChange,
    famsClmasSerialNo,
    famsClmasDate,
  ]);
  //Call API only if it's approveCas
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let response;
        let userData = [];

        // fetchGroups
        response = await viewCaseService.getUserData({
          input_user_grade: "",
          input_location: "",
          input_department_name: department_name,
        });

        userData =
          response?.entries?.map((entry) => ({
            text: entry?.content?.properties?.object_name,
            value: entry?.content?.properties?.object_name,
          })) || [];

        setUserNames(userData);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };

    if (approveCase && designation !== "CGM") {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveCase, userData]);

  useEffect(() => {
    const shouldFetch = (approveCase || internal || interOffice || interDepartmental || delegate) && (selectedTOTE || selectedVertical || selectedGroup);

    if (!shouldFetch) return;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        let response;
        let userData = [];

        const isInitiateDept = isDMDChairmanConditionMatch && interDepartmental && tagName === "approveCase";

        const isECMGroup = selectedGroup?.value?.toLowerCase()?.startsWith("ecm_");

        // Compute departmentData value (extracted from nested ternary for readability)
        let departmentData;
        if ((internal || approveCase) && designation === "CGM") {
          departmentData = selectedCGMDept?.value;
        } else if (interDepartmental || interOffice) {
          departmentData = selectedVertical?.value;
        } else {
          departmentData = department_short_code;
        }

        // Compute dept_short_code_multi value (extracted from nested ternary for readability)
        let deptShortCodeMulti;
        if (internal && office_type !== "HO") {
          deptShortCodeMulti = [param_department];
        } else if (isInitiateDept) {
          deptShortCodeMulti = [departmentShortCode];
        } else {
          deptShortCodeMulti = [departmentData || department_short_code];
        }

        response = await viewCaseService.getUserNames({
          "run-stateless": "true",
          data: {
            variables: {
              is_group: isECMGroup,
              office_type: interOffice ? selectedOfficeType : office_type,
              remove_user_name: object_name,
              dept_short_code_multi: deptShortCodeMulti,
              ro_short_code: interOffice ? selectedTOTE?.value : office_type !== "HO" ? ro_short_code : "",
              group_name: isECMGroup ? selectedGroup?.value : "",
              user_grade: isECMGroup ? "" : selectedGroup?.value,
            },
          },
        });

        setIsLoading(false);

        userData =
          response?.data?.variables?.op_user_name?.map((entry) => ({
            text: entry,
            value: entry,
          })) || [];

        setUserNames(userData);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveCase, internal, interOffice, interDepartmental, delegate, selectedTOTE, selectedVertical, selectedGroup]);

  //For Get Grades
  useEffect(() => {
    if (fetchedRef.current) return; // already called

    fetchedRef.current = true;

    const fetchGroups = async () => {
      setIsLoading(true);

      try {
        const response = await viewCaseService.getGrade({
          "run-stateless": "true",
          data: {
            variables: {
              in_user_grade: user_grade,
              in_login_user: object_name,
              flag: true,
            },
          },
        });

        const groups =
          response?.data?.variables?.out_list_of_grades?.map((grade) => ({
            text: grade,
            value: grade,
          })) || [];

        const filteredGroups =
          interOffice || interDepartmental || (internal && office_type !== "HO")
            ? groups.filter((group) => !group.value.startsWith("ecm_") && !group.text.startsWith("ecm_"))
            : groups;

        setIsLoading(false);
        setGroupName(filteredGroups);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    setSelectedCGMDept(null);
    setSelectedGroup(null);
  }, [selectedValue]);

  // Format grade/group display text: GRADE_A → Grade A, GRADE_E(OIC) → Grade E (OIC), etc.
  const formatDisplayText = (text) => {
    const lower = text.toLowerCase();
    if (lower === "ecm_dmds1_dmd") return "DMD(GSR)";
    if (lower === "ecm_dmds2_dmd") return "DMD(AKS)";
    if (lower === "ecm_chairman") return "Chairman";

    // Handle GRADE_E(OIC) → Grade E (OIC)
    const gradeWithSuffixMatch = text.match(/^grade_([a-zA-Z])\((.+)\)$/i);
    if (gradeWithSuffixMatch) {
      return `Grade ${gradeWithSuffixMatch[1].toUpperCase()} (${gradeWithSuffixMatch[2].toUpperCase()})`;
    }

    // Handle GRADE_A → Grade A
    const gradeMatch = text.match(/^grade_([a-zA-Z])$/i);
    if (gradeMatch) {
      return `Grade ${gradeMatch[1].toUpperCase()}`;
    }

    // Handle GROUP_B → Group B
    const groupMatch = text.match(/^group_([a-zA-Z])$/i);
    if (groupMatch) {
      return `Group ${groupMatch[1].toUpperCase()}`;
    }

    return text.toUpperCase();
  };

  // Dynamic seniority ranking: ECM roles first (chairman > dmd), then grades descending (F > E(OIC) > E > D > ... > A), then groups
  const getSeniorityRank = (value) => {
    const lower = value.toLowerCase();

    // ECM Chairman = highest
    if (lower.includes("chairman")) return 0;
    // ECM DMD roles
    if (lower.includes("dmd")) return 1;

    // Grade with suffix like grade_e(oic) — same letter rank but slightly higher than plain grade
    const gradeWithSuffixMatch = lower.match(/^grade_([a-z])\(.+\)$/);
    if (gradeWithSuffixMatch) {
      // 'a'=97, 'f'=102 → invert so F(102) ranks higher: 200 - charCode
      return 200 - gradeWithSuffixMatch[1].charCodeAt(0) - 0.5;
    }

    // Plain grade like grade_a, grade_f
    const gradeMatch = lower.match(/^grade_([a-z])$/);
    if (gradeMatch) {
      return 200 - gradeMatch[1].charCodeAt(0);
    }

    // Group entries come after grades
    if (lower.startsWith("group")) return 300;

    // Anything else goes last
    return 400;
  };

  const groupNameSort = groupName
    ?.filter((item) => item?.text && item?.value && !["ecm_dmds1_dmd_ea", "ecm_dmds2_dmd_ea", "ecm_chairman_ea"].includes(item.text.toLowerCase()))
    ?.map((item) => ({ ...item, text: formatDisplayText(item.text) }))
    ?.sort((a, b) => getSeniorityRank(a.value) - getSeniorityRank(b.value));

  const hoDeptCGMGMName = [
    {
      text: "GRADE_E",
      value: "grade_e",
    },
    {
      text: "GRADE_E(OIC)",
      value: "grade_e(oic)",
    },
    {
      text: "GRADE_F",
      value: "grade_f",
    },
  ];

  const handleTypeOfficeChange1 = async (event) => {
    if (internal) {
      if (!isUserExistData && !foundConditionMatch) {
        showSweetAlert({
          text: "The case is being forwarded to another vertical/department/office. Since it does not belong to your vertical/department/office, case details will not be available. If required, please download the case details for your reference before forwarding.",
        });
      }
    }

    setMarkSelector(event.value);

    // Reset everything else
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedCGMDept(null);
    setIsLoading(false);
    setInitiatorName("");

    if (!markSelector) {
      try {
        setIsLoading(true);

        const response = await viewCaseService.getUserData({
          input_name: rCreatorName,
        });

        const userData =
          response?.entries?.map((entry) => ({
            uin: entry?.content?.properties?.uin,
            designation: entry?.content?.properties?.designation,
            object_name: entry?.content?.properties?.object_name,
          })) || [];

        setIsLoading(false);
        setSelectedUser(userData);
        setInitiatorName(userData);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (tagName === "fbd" && internal && lastItemDecision === "Routing" && result !== object_name) {
        try {
          const response = await viewCaseService.getUserData({
            input_name: result,
          });

          const userData =
            response?.entries?.map((entry) => ({
              uin: entry?.content?.properties?.uin,
              designation: entry?.content?.properties?.designation,
            })) || [];

          setUserData(userData);

          setSelectedGroup({
            text: response?.entries?.[0]?.content?.properties?.user_grade?.toUpperCase(),
            value: response?.entries?.[0]?.content?.properties?.user_grade,
          });
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchData();
  }, [internal, lastItemDecision, result, tagName]);

  // Auto-select user after userNames is populated from the selectedGroup change above
  useEffect(() => {
    if (tagName === "fbd" && internal && lastItemDecision === "Routing" && result !== object_name && userNames.length > 0) {
      const matchedUser = userNames.find((user) => user.value === result);
      if (matchedUser) {
        setSelectedUser({ text: matchedUser.text, value: matchedUser.value });
      }
    }
  }, [userNames, tagName, internal, lastItemDecision, result, object_name]);

  useEffect(() => {
    const showAlert = (condition, selectedValue) => {
      if (condition && selectedValue?.value && !isUserExistData && !foundConditionMatch) {
        showSweetAlert({
          text: "The case is being forwarded to another vertical/department/office. Since it does not belong to your vertical/department/office, case details will not be available. If required, please download the case details for your reference before forwarding.",
        });
      }
    };

    showAlert(interDepartmental, selectedVertical);
    showAlert(interOffice, selectedTOTE);
  }, [interDepartmental, selectedVertical, interOffice, selectedTOTE]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await viewCaseService.getBackwardPerformers({
          "run-stateless": "true",
          data: {
            packages: {
              case_folder: {
                properties: {
                  id: folderId,
                },
                href: `folders/cms_case_folder/${folderId}`,
              },
              user_profile: {
                properties: {
                  id: id,
                },
                href: `contents/cms_user_profile/${id}`,
              },
            },
            variables: {},
          },
        });

        setBackwardDropData(
          response?.data?.variables?.performers?.map((entry) => ({
            text: entry,
            value: entry,
          })) || [],
        );
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (backward) {
      fetchData();
    }
  }, [backward]);

  return (
    <>
      {isLoading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      {backward ? (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <p className="mb-0">
            Choose the previous performer: <span className="required-asterisk">*</span>
          </p>
          <DropDownList
            data={backwardDropData}
            textField="text"
            dataItemKey="value"
            value={selectedUser}
            className="w-50 case-form-dropdown"
            onChange={(e) => handleSelectUser(e)}
          />
        </div>
      ) : (
        <>
          {approveCase && (
            <>
              {office_type !== "HO" ? (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">Choose Department:</p>
                  <DropDownList
                    data={departmentGroup
                      ?.filter((item) => item && item.text && item.value && item.text !== department_name)
                      ?.filter((item) => item.text?.toLowerCase().includes(chooseDeptFilter?.toLowerCase()))}
                    filterable={true}
                    textField="text"
                    dataItemKey="value"
                    value={selectedCGMDept}
                    disabled={markSelector}
                    className="w-50 case-form-dropdown"
                    onChange={(e) => handleGetCGMUsers(e)}
                    onFilterChange={(e) => setChooseDeptFilter(e.filter.value)}
                  />
                </div>
              ) : (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">Choose Grade:</p>
                  <DropDownList
                    data={groupNameSort}
                    textField="text"
                    dataItemKey="value"
                    value={selectedGroup}
                    disabled={markSelector}
                    className="w-50 case-form-dropdown"
                    onChange={(e) => handleSelectGroupChange(e)}
                  />
                </div>
              )}
            </>
          )}

          {internal && (
            <>
              {foundConditionMatch && office_type === "HO" && (
                <RadioGroup className="mb-3" layout="horizontal" data={radioOptions} value={selectedValue} onChange={(e) => setSelectedValue(e.value)} />
              )}

              {!isDMDChairmanConditionMatch && tagName === "approveCase" && (
                <>
                  {tagName === "approveCase" && selectedValue === "internalRadio" && (
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <p className="mb-0">Mark to Initiator</p>
                      <Checkbox
                        data={option}
                        size={"medium"}
                        value={markSelector}
                        layout={"horizontal"}
                        className="outlined-checkbox"
                        disabled={selectedCGMDept || selectedGroup}
                        onChange={handleTypeOfficeChange1}
                      />
                    </div>
                  )}
                </>
              )}

              {tagName === "approveCase" && office_type !== "HO" && selectedValue === "internalRadio" && (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">Choose Department:</p>
                  <DropDownList
                    data={departmentGroup
                      ?.filter((item) => item && item.text && item.value && item.text !== department_name)
                      ?.filter((item) => item.text?.toLowerCase().includes(chooseDeptFilter?.toLowerCase()))}
                    filterable={true}
                    textField="text"
                    dataItemKey="value"
                    value={selectedCGMDept}
                    disabled={markSelector}
                    className="w-50 case-form-dropdown"
                    onChange={(e) => handleGetCGMUsers(e)}
                    onFilterChange={(e) => setChooseDeptFilter(e.filter.value)}
                  />
                </div>
              )}

              {tagName === "approveCase" && office_type === "HO" && selectedValue === "internalRadio" && (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">
                    Choose Group/Grade: <span className="required-asterisk">*</span>
                  </p>
                  <DropDownList
                    data={groupNameSort}
                    textField="text"
                    dataItemKey="value"
                    value={selectedGroup}
                    disabled={markSelector}
                    className="w-50 case-form-dropdown"
                    onChange={(e) => handleSelectGroupChange(e)}
                  />
                </div>
              )}

              {tagName !== "approveCase" && selectedValue === "internalRadio" && (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">
                    Choose Group/Grade: <span className="required-asterisk">*</span>
                  </p>
                  <DropDownList
                    data={groupNameSort}
                    textField="text"
                    dataItemKey="value"
                    value={selectedGroup}
                    disabled={internal ? selectedCGMDept : markSelector}
                    className="w-50 case-form-dropdown"
                    onChange={(e) => handleSelectGroupChange(e)}
                  />
                </div>
              )}

              {selectedValue === "dmdRadio" && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">
                      Choose Department: <span className="required-asterisk">*</span>
                    </p>
                    <DropDownList
                      data={departmentGroup
                        ?.filter((item) => item && item.text && item.value && item.text !== department_name)
                        ?.filter((item) => item.text?.toLowerCase().includes(chooseDeptFilter?.toLowerCase()))}
                      filterable={true}
                      textField="text"
                      dataItemKey="value"
                      value={selectedCGMDept}
                      disabled={markSelector}
                      className="w-50 case-form-dropdown"
                      onChange={(e) => handleCGMGMUsers(e)}
                      onFilterChange={(e) => setChooseDeptFilter(e.filter.value)}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">Choose Group/Grade:</p>
                    <DropDownList
                      data={hoDeptCGMGMName}
                      textField="text"
                      dataItemKey="value"
                      value={selectedGroup}
                      className="w-50 case-form-dropdown"
                      onChange={(e) => handleSelectCGMGMGroupChange(e)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {interDepartmental && (
            <>
              {isDMDChairmanConditionMatch && tagName === "approveCase" ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">Mark to Initiator</p>
                    <Checkbox
                      data={option}
                      size={"medium"}
                      value={markSelector}
                      layout={"horizontal"}
                      className="outlined-checkbox"
                      disabled={selectedCGMDept || selectedGroup}
                      onChange={handleTypeOfficeChange1}
                    />
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">
                      Choose Group/Grade: <span className="required-asterisk">*</span>
                    </p>
                    <DropDownList
                      data={hoDeptCGMGMName}
                      textField="text"
                      dataItemKey="value"
                      value={selectedGroup}
                      disabled={markSelector}
                      onChange={(e) => handleSelectGroupChange(e)}
                      className="w-50 case-form-dropdown"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">
                      Choose Department: <span className="required-asterisk">*</span>
                    </p>
                    <DropDownList
                      data={verticalGroup
                        ?.filter((item) => item && item.text && item.value && item.text !== department_name)
                        ?.filter((item) => !["DMDS1", "DMDS2", "CHMNS"].includes(item.text?.toUpperCase()) && !["DMDS1", "DMDS2", "CHMNS"].includes(item.value?.toUpperCase()))
                        ?.filter((item) => item.text?.toLowerCase().includes(chooseDeptFilter?.toLowerCase()))}
                      filterable={true}
                      textField="text"
                      dataItemKey="value"
                      value={selectedVertical}
                      onChange={(e) => handleSelectVertical(e)}
                      onFilterChange={(e) => setChooseDeptFilter(e.filter.value)}
                      className="w-50 case-form-dropdown"
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <p className="mb-0">Choose Grade:</p>
                    <DropDownList
                      data={groupNameSort}
                      textField="text"
                      dataItemKey="value"
                      value={selectedGroup}
                      disabled={!selectedVertical}
                      onChange={(e) => handleSelectGroupChange(e)}
                      className="w-50 case-form-dropdown"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {interOffice && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p></p>
                <RadioGroup
                  data={office_type === "HO" ? officeTypeOptions?.filter((option) => option.value !== "HO") : officeTypeOptions}
                  layout={"horizontal"}
                  value={selectedOfficeType}
                  onChange={handleTypeOfficeChange}
                />
              </div>

              {selectedOfficeType !== "HO" && (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">
                    Choose RO/TE: <span className="required-asterisk">*</span>
                  </p>
                  <DropDownList
                    data={regionGroup.filter((item) => item?.text && item?.value).filter((item) => item.text?.toLowerCase().includes(chooseROTEFilter?.toLowerCase()))}
                    filterable={true}
                    textField="text"
                    dataItemKey="value"
                    value={selectedTOTE}
                    onChange={handleSelectRegion}
                    disabled={!selectedOfficeType}
                    className="w-50 case-form-dropdown"
                    onFilterChange={(e) => setChooseROTEFilter(e.filter.value)}
                  />
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="mb-0">Choose Department: {selectedOfficeType === "HO" && <span className="required-asterisk">*</span>} </p>
                <DropDownList
                  data={departmentNames
                    ?.filter((item) => item && item.text && item.value)
                    ?.filter((item) => !["DMDS1", "DMDS2", "CHMNS"].includes(item.text?.toUpperCase()) && !["DMDS1", "DMDS2", "CHMNS"].includes(item.value?.toUpperCase()))
                    ?.filter((item) => item.text?.toLowerCase().includes(chooseDeptFilter?.toLowerCase()))}
                  textField="text"
                  dataItemKey="value"
                  value={selectedVertical}
                  disabled={selectedOfficeType !== "HO" && !selectedTOTE}
                  onChange={(e) => handleSelectDepartment(e)}
                  className="w-50 case-form-dropdown"
                  filterable={true}
                  onFilterChange={(e) => setChooseDeptFilter(e.filter.value)}
                />
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="mb-0">Choose Grade:</p>
                <DropDownList
                  data={groupNameSort}
                  textField="text"
                  dataItemKey="value"
                  value={selectedGroup}
                  disabled={!selectedOfficeType}
                  onChange={(e) => handleSelectGroupChange(e)}
                  className="w-50 case-form-dropdown"
                />
              </div>
            </>
          )}

          {delegate && (
            <div className="d-flex justify-content-between align-items-center mb-2">
              <p className="mb-0">
                Choose Group/Grade: <span className="required-asterisk">*</span>
              </p>
              <DropDownList
                data={groupNameSort}
                textField="text"
                dataItemKey="value"
                value={selectedGroup}
                className="w-50 case-form-dropdown"
                onChange={(e) => handleSelectGroupChange(e)}
              />
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center">
            <p className="mb-0">
              {/* label change for internal Attention To - Select User always jira nr 198 */}
              {internal || (interOffice && caseNature === "Confidential" && office_type === "RO") || (interDepartmental && caseNature === "Confidential" && office_type === "HO")
                ? "Select User:"
                : "Attention To:"}

              {internal && <span className="required-asterisk">*</span>}
              {interOffice && caseNature === "Confidential" && office_type === "RO" && <span className="required-asterisk">*</span>}
              {interOffice && caseNature === "Confidential" && <span className="required-asterisk">*</span>}

              {interDepartmental && caseNature === "Confidential" && office_type === "HO" && <span className="required-asterisk">*</span>}
              {interDepartmental && office_type !== "HO" && <span className="required-asterisk">*</span>}
              {interDepartmental && isDMDChairmanConditionMatch && tagName === "approveCase" && <span className="required-asterisk">*</span>}
            </p>
            <DropDownList
              data={Array.from(new Map(userNames?.filter((item) => item && item.text && item.value)?.map((item) => [item.text, item])).values())?.filter((item) =>
                item?.text?.toLowerCase().includes(attentionToFilter?.toLowerCase()),
              )}
              filterable={true}
              textField="text"
              dataItemKey="value"
              value={selectedUser}
              disabled={markSelector ? markSelector : selectedValue === "dmdRadio" ? !selectedCGMDept : ""}
              className="w-50 case-form-dropdown"
              onChange={(e) => handleSelectUser(e)}
              onFilterChange={(e) => setAttentionToFilter(e.filter.value)}
            />
          </div>

          {interDepartmental &&
            tagName === "fbd" &&
            ((office_type === "HO" && selectedVertical?.value === "id") || (office_type === "RO" && selectedVertical?.value === "cac")) && (
              <>
                <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                  <p className="mb-0">FAMS/CLMAS Serial Number:</p>
                  <Input autoComplete="off" className="w-50 case-form-dropdown" value={famsClmasSerialNo} onChange={(e) => setFamsClmasSerialNo(e.target.value)} />
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <p className="mb-0">FAMS/CLMAS Date:</p>
                  <DatePicker
                    format="dd/MM/yyyy"
                    placeholder="DD/MM/YYYY"
                    className="w-50 case-form-dropdown"
                    value={famsClmasDate}
                    onChange={(e) => setFamsClmasDate(e.target.value)}
                  />
                </div>
              </>
            )}
        </>
      )}

      {initiatorName?.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2">
            <strong>UIN:</strong>
            {initiatorName && initiatorName?.length > 0 ? initiatorName?.[0]?.uin : "N/A"}
          </div>
          <div className="mb-2">
            <strong>Designation:</strong> {initiatorName && initiatorName?.length > 0 ? initiatorName?.[0]?.designation : "N/A"}
          </div>
          <div className="mb-2">
            <strong>Name: </strong>
            {initiatorName && initiatorName?.length > 0 ? initiatorName?.[0]?.object_name : "N/A"}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2">
            <strong>UIN:</strong>
            {userData && userData?.length > 0 ? userData?.[0]?.uin : "N/A"}
          </div>
          <div>
            <strong>Designation:</strong> {userData && userData?.length > 0 ? userData?.[0]?.designation : "N/A"}
          </div>
        </div>
      )}
    </>
  );
};

export default ChooseUserGroup;
