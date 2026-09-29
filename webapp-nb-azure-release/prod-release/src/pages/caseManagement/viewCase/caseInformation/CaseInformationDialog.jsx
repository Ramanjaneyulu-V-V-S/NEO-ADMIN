import React, { useState } from "react";

//styled components
import * as S from "./caseInformation.styles";

//kendo components
import { Input } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";

//custom components
import CustomTooltip from "../../../../components/customTooltip/CustomTooltip";
import FileNumberDialog from "../../../../components/fileNumberDialog/FileNumberDialog";

//react Icons
import { IoFileTrayFull } from "react-icons/io5";

const getPriorityClass = (priority) => {
  switch (priority) {
    case "Urgent":
      return "priority-urgent";
    case "Immediate":
      return "priority-immediate";
    default:
      return "priority-default";
  }
};

const CaseInformationDialog = ({
  onClose,
  visible = false,
  caseFields = [],
  editValues = {},
  caseDetails = null,
  handleFieldChange = () => {},
  dropdownOptionsMap = {},
  toCamelCase = () => {},
  loading = false,
  fileNumbers = [],
  handleSaveEditData = () => {},
  isSameWorkflowUser,
  isInitiateWorkflow,
  caseStatus,
  movementRegisterData,
  fileNumbersLoading = false,
  fileNumbersPagination = {},
  onFileNumbersFetch,
}) => {
  const [fileNoPop, setFileNoPop] = useState(false);
  const [editData, setEditData] = useState(false);
  const [selectedFileNumber, setSelectedFileNumber] = useState(null);

  // Safety checks and data validation
  const safeCaseFields = Array.isArray(caseFields) ? caseFields.filter((field) => Array.isArray(field) && field.length >= 2 && field[0]) : [];
  const hasFields = safeCaseFields.length > 0;

  const handleFileNumberSelect = (fileNumber) => {
    setSelectedFileNumber(fileNumber);
    handleFieldChange("File No", fileNumber);
  };
  const handleClose = () => {
    if (editData) {
      setEditData(false);
    }
    onClose();
  };
  const handleSave = async () => {
    const success = await handleSaveEditData();
    // Stop edit mode after successful save
    if (success) {
      setEditData(false);
    }
  };

  return (
    visible && (
      <>
        <Dialog title="Case Information" onClose={handleClose} className="case-info-dialog-wh">
          <div className="p-3">
            {hasFields ? (
              safeCaseFields.map((field, index) => {
                const [label, value] = field;
                const key = label.replace(/\s/g, "")?.toLowerCase();
                const camelLabel = toCamelCase(label);
                const isEditableDropdown = editData && key !== "natureofcase" && Object.hasOwn(dropdownOptionsMap, key);
                const isEditableTextArea = editData && key === "subject";
                const currentValue = Object.hasOwn(editValues, camelLabel) ? editValues[camelLabel] : dropdownOptionsMap[key]?.find((item) => item.value === value);
                const subjectValue = Object.hasOwn(editValues, label) ? editValues[label] : value;

                return (
                  <React.Fragment key={`${label}-${index}`}>
                    {loading && (
                      <div className="k-loading-mask">
                        <div className="k-loading-image"></div>
                      </div>
                    )}

                    <div className="row case-info-row d-flex align-items-center mb-2">
                      <div className="font-size-12 line- col-4">
                        <strong>{label}</strong>
                      </div>
                      <div className="font-size-12 col-8">
                        {isEditableDropdown ? (
                          key === "fileno" ? (
                            <div className="input-group">
                              <Input readOnly value={editValues?.fileNo?.value || currentValue?.value || ""} className="custom-input" />
                              <div
                                className="border input-group-append"
                                onClick={() => {
                                  setSelectedFileNumber(editValues?.fileNo || currentValue || null);
                                  setFileNoPop(true);
                                }}
                              >
                                <IoFileTrayFull size={20} cursor="pointer" />
                              </div>
                            </div>
                          ) : (
                            <DropDownList
                              data={dropdownOptionsMap[key]}
                              value={currentValue}
                              onChange={(e) => handleFieldChange(label, e.value)}
                              className="edit-case-info-dropdown"
                              textField="value"
                              dataItemKey="value"
                            />
                          )
                        ) : isEditableTextArea ? (
                          <Input maxLength={250} defaultValue={subjectValue} onChange={(e) => handleFieldChange(label, e.target.value)} className="edit-case-info-dropdown" />
                        ) : label === "Case Priority" ? (
                          <>
                            :&nbsp;
                            {value ? <span className={`priority-btn ${getPriorityClass(value)}`}>{value}</span> : <span>N/A</span>}
                          </>
                        ) : label === "Reason for Cancellation" ? (
                          <span>
                            :&nbsp;
                            <CustomTooltip tooltip={caseDetails?.properties?.reason_for_cancellation || "Not provided"}>
                              <span>{value}</span>
                            </CustomTooltip>
                          </span>
                        ) : (
                          <span>:&nbsp;{value}</span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            ) : (
              <S.EmptyState>
                <p className="text-muted mb-0">No case information available</p>
              </S.EmptyState>
            )}
          </div>
          <DialogActionsBar>
            <div className="d-flex justify-content-end gap-2">
              {isSameWorkflowUser && !editData && ((!isInitiateWorkflow && caseStatus === "Draft") || movementRegisterData?.length === 0) && (
                <Button className="common-btn-css save-button" onClick={() => setEditData(true)}>
                  Edit
                </Button>
              )}
              {editData && (
                <Button className="common-btn-css submit-button" onClick={handleSave}>
                  Save
                </Button>
              )}
              <Button className="common-btn-css cancel-button" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </DialogActionsBar>
        </Dialog>

        {fileNoPop && (
          <FileNumberDialog
            fileNumbers={fileNumbers}
            onClose={() => setFileNoPop(false)}
            selectedFileNumber={selectedFileNumber}
            onSelectFileNumber={handleFileNumberSelect}
            isLoading={fileNumbersLoading}
            paginationTotal={fileNumbersPagination?.total}
            onFetch={onFileNumbersFetch}
          />
        )}
      </>
    )
  );
};

export default CaseInformationDialog;
