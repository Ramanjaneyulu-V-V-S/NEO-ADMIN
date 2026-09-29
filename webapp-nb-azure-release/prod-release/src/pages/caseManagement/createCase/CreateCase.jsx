import { useEffect, useState, useMemo, useCallback, useRef } from "react";

//components
import Layout from "../../../components/layout/Layout";

//kendo components
import { Label } from "@progress/kendo-react-labels";
import { Button } from "@progress/kendo-react-buttons";
import { Dialog } from "@progress/kendo-react-dialogs";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Input, TextArea } from "@progress/kendo-react-inputs";

//react icons
import { IoFileTrayFull } from "react-icons/io5";

//react form hook
import { Controller, useForm } from "react-hook-form";

//utils
import { formatDateOnly } from "../../../utils/Utils";

//react-router-dom
import { useLocation, useNavigate } from "react-router-dom";

//custom components
import CaseAction from "../../../components/caseAction/CaseAction";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import { validateFileSignature } from "../../../utils/validateFileSignature";
import RichTextEditor from "../../../components/richTextEditor/RichTextEditor";
import FileNumberDialog from "../../../components/fileNumberDialog/FileNumberDialog";

//import default dropdown data
import { casePriority, natureOfCase, getDisposalLevels, languages } from "../../data/DropdownData";

//redux
import { useDispatch, useSelector } from "react-redux";

//slice
import { fetchDepartments } from "../../../redux/dashboard/dashboardSlice";
import { getUserProfile, updateUserProfile } from "../../../redux/login/loginSlice";
import { createCaseService } from "../../../services/caseManagement/createCase/createCaseService";
import { fetchFileNumbers, fetchVertical } from "../../../redux/caseManagement/createCase/createCaseSlice";
//hooks
import { usePublishIv } from "../../../hooks/usePublishIv";

//redux
import { ServiceUrl } from "../../../services/serviceUrl";
import axiosInstance from "../../../services/axiosConfig";
import { digidakCorrespondenceService } from "../../../services/digidak/correspondence/digidakCorrespondenceService";
import { documentService } from "../../../services/caseManagement/documents/documentsService";

const hasValidEditorContent = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return doc.body.textContent.trim()?.length > 0;
};

// Reusable form field component for dropdown fields
const FormDropdownField = ({ name, label, control, rules, data, errors, disabled, onChange, ...rest }) => (
  <div className="col-xs-12 col-sm-6 col-md-4">
    <Label className="case-form-label">
      {label} <span className="required-asterisk">*</span>
    </Label>
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <DropDownList
          data={data}
          value={field.value}
          onChange={(e) => {
            field.onChange(e.value);
            onChange?.(e);
          }}
          className="case-form-dropdown"
          textField="text"
          dataItemKey="value"
          disabled={disabled}
          {...rest}
        />
      )}
    />
    {errors[name] && <div className="form-error">{errors[name].message}</div>}
  </div>
);

export default function CreateCase() {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { path, digidakObjectId } = location.state || {};
  const { userProfile } = useSelector((state) => state?.login);
  const { id, office_type, object_name, ro_short_code, user_login_name, department_name, department_short_code, vertical_name, vertical_short_code } =
    userProfile?.properties || {};
  const { vertical, caseTypes, fileNumbers, fileNumbersPagination, loading } = useSelector((state) => state.createCase);
  const { departmentNames } = useSelector((state) => state?.dashboard);
  const departments = useMemo(() => [{ value: department_short_code, text: (department_short_code || "").toUpperCase() }], [department_short_code]);

  // Custom hook for IV publishing
  const { publish: publishIv } = usePublishIv();

  const [selectedAction, setSelectedAction] = useState("upload");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedFileNumber, setSelectedFileNumber] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState("");
  const [base64File, setBase64File] = useState("");
  const [isNotesheetDialogOpen, setIsNotesheetDialogOpen] = useState(false);
  const [notesheetPreview, setNotesheetPreview] = useState(false);
  const [createdNotesheet, setCreatedNotesheet] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [changeDropdown, setChangeDropdown] = useState(false);
  const [fileNoPop, setFileNoPop] = useState(false);

  // Synchronous guard against double-submits
  const inFlightRef = useRef(false);

  const {
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      department: department_short_code
        ? {
            text: department_short_code,
            value: department_short_code,
          }
        : null,
      caseType: "",
      casePriority: "",
      natureOfCase: natureOfCase.find((n) => n.text === "Regular") || "",
      fileNumber: "",
      division: "",
      caseLanguage: "",
      disposalLevel: "",
      subject: "",
      year: "",
    },
  });

  const isPreviewEnabled = isValid && ((selectedAction === "notesheet" && createdNotesheet) || (selectedAction === "upload" && selectedFile !== null));

  // Extracted: builds the case name string used in create and preview
  const buildCaseName = useCallback(
    (deptValue, year) => {
      return office_type === "HO" ? `NB-${deptValue?.toUpperCase()}` : `NB-${office_type?.toUpperCase()}-${ro_short_code?.toUpperCase()}-${deptValue?.toUpperCase()}-${year}`;
    },
    [office_type, ro_short_code],
  );

  const handleResetForm = () => {
    reset();
    setSelectedAction("notesheet");
    setCreatedNotesheet(false);
    setEditorContent("");
    setSelectedFile(null);
  };

  const handleSelectTab = (e) => {
    setSelectedAction(e);
    if (e === "notesheet") {
      setSelectedFile(null);
    } else {
      setEditorContent("");
      setCreatedNotesheet(false);
    }
  };

  const onEditorChange = (event) => {
    setEditorContent(event.html);
  };

  const ALLOWED_EXTENSIONS = [".doc", ".docx"];

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Get file extension in lowercase
    const fileExtension = file.name.substring(file.name.lastIndexOf("."))?.toLowerCase();

    // Validate file extension
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Format",
        text: `Only the following formats are allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
      e.target.value = ""; // Reset file input
      return;
    }

    // Validate file content matches its extension (detect renamed files)
    const signatureResult = await validateFileSignature(file);
    if (!signatureResult.valid) {
      showSweetAlert({
        icon: "error",
        title: "Invalid File Content",
        text: signatureResult.message,
      });
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleCreateCase = async () => {
    if (inFlightRef.current) return;

    if (selectedAction === "notesheet" && !createdNotesheet) {
      return showSweetAlert({ title: "Error", text: "Please add Notesheet", icon: "error" });
    }
    if (selectedAction === "upload" && selectedFile === null) {
      return showSweetAlert({ title: "Error", text: "Please upload a file", icon: "error" });
    }

    inFlightRef.current = true;
    setIsCreatingCase(true);

    const values = getValues();
    const { department, caseType, natureOfCase, subject, casePriority, fileNumber, caseLanguage, division, disposalLevel, year } = values;

    const caseName = buildCaseName(department?.value, year);

    const payload = {
      "run-stateless": "true",
      data: {
        variables: {
          title_as_code: ro_short_code || "",
          performer_display_name: object_name,
          caseNameInput: caseName,
          officeType: office_type,
          department: department?.text,
          deptShortCode: department?.value,
          vertical: office_type === "HO" ? division?.text : "",
          vertShortCode: office_type === "HO" ? division?.value : "",
          language: caseLanguage?.text,
          caseType: caseType?.text,
          casePriority: casePriority?.text,
          caseNature: natureOfCase?.text,
          year: year,
          fileNumber: fileNumber?.value,
          disposalLevel: disposalLevel?.text,
          subject: subject,
          location: userProfile?.properties?.location,
        },
      },
    };

    try {
      const response = await createCaseService.createCase(payload);
      const folderId = response?.data?.variables?.case_obj_id;
      const autoNumOutput = response?.data?.variables?.autoNumOutput;
      if (path === "digidakInitiateCase") {
        await digidakCorrespondenceService.providePermission({
          "run-stateless": "true",
          data: {
            variables: {
              in_flag: "Inprocess",
              in_case_object_id: folderId,
            },
            packages: {
              digidak_folder: {
                properties: { id: digidakObjectId },
                href: `folders/cms_digidak_folder/${digidakObjectId}`,
              },
            },
          },
        });
      }

      if (!folderId) {
        throw new Error("Case not created.");
      }

      let notesheetDocId = null;

      if (selectedAction === "notesheet") {
        const notesheetData = {
          "run-stateless": "true",
          data: {
            variables: {
              in_contentType: "msw12",
              in_path: `/Case/${autoNumOutput}`,
              in_docName: "notesheet.docx",
              in_docType: "cms_note_document",
              in_editorContenet: editorContent,
              in_subject: subject,
            },
          },
        };
        const response = await createCaseService.createNotesheet(notesheetData);
        notesheetDocId = response?.data?.variables?.out_docId;
        if (!notesheetDocId) throw new Error("Notesheet creation failed.");
      }

      if (selectedAction === "upload") {
        const uploadRes = await documentService.getFilePath(selectedFile);
        const fileSrc = uploadRes?.entries?.[0]?.content?.src;
        if (!fileSrc) throw new Error("File upload failed");
        const uploadPayload = {
          properties: {
            a_content_type: "msw12",
            r_object_type: "cms_note_document",
            object_name: selectedFile.name,
            case_number: autoNumOutput,
            folder_id: folderId,
          },
          type: "cms_note_document",
          source: fileSrc,
        };
        const uploadResponse = await createCaseService.uploadDocument(uploadPayload);
        notesheetDocId = uploadResponse?.properties?.r_object_id;
        if (!notesheetDocId) throw new Error("Notesheet upload failed.");
      }

      if (changeDropdown) {
        await dispatch(
          updateUserProfile({
            "run-stateless": "true",
            data: {
              variables: {
                inp_dept_name: department?.text,
                inp_dept_short_code: department?.value,
                inp_object_id: id,
              },
            },
          }),
        ).unwrap();
        // Always refresh after update
        await dispatch(
          getUserProfile({
            input_user_login_name: user_login_name,
          }),
        ).unwrap();
      }

      // Publish IV for the notesheet document
      if (notesheetDocId) {
        try {
          await publishIv(notesheetDocId);
        } catch {
          // IV publication failure is non-blocking
        }
      }

      setIsCreatingCase(false);
      inFlightRef.current = false;

      // Navigate to view case (proceed even if IV publication had issues)
      navigate(`/view-case/${folderId}`, {
        state: {
          screenName: "createCaseScreen",
          path: path,
          autoNumOutput: autoNumOutput,
          folderId: folderId,
          caseStatus: "Draft",
          isInitiateWorkflow: false,
        },
      });
    } catch (error) {
      setIsCreatingCase(false);
      inFlightRef.current = false;
      showSweetAlert({ title: "Error", text: error.message, icon: "error" });
    }
  };

  useEffect(() => {
    if (office_type === "HO" && vertical?.length > 0) {
      // Create default vertical object from user profile
      const defaultVertical = {
        value: vertical_short_code,
        text: vertical_name,
      };

      // Check if this default exists in fetched dropdown
      const matched = vertical?.find((v) => v.value?.toLowerCase() === defaultVertical.value?.toLowerCase() && v.text?.toLowerCase() === defaultVertical.text?.toLowerCase());

      if (matched) {
        setValue("division", matched); // set as form default
      }
    }
  }, [office_type, vertical, vertical_name, vertical_short_code, setValue]);

  useEffect(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
    const financialYear = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

    reset({ year: financialYear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (department_short_code) {
      const defaultDept = {
        text: department_name,
        value: department_short_code,
      };
      setSelectedDepartment(defaultDept);
      setValue("department", defaultDept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //for HO
  useEffect(() => {
    if (office_type === "HO" && selectedDepartment?.value) {
      dispatch(
        fetchVertical({
          input_folder: `/ECM CONFIG/Office Type/HO/${selectedDepartment.text}`,
        }),
      );
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office_type, selectedDepartment]);

  //case type
  useEffect(() => {
    if (!selectedDepartment) return;

    const params = {
      input_ho_ro: office_type,
      input_dept_short_code: selectedDepartment?.value,
      ...(office_type !== "HO" && { input_ro_short_code: ro_short_code }),
    };

    dispatch(fetchFileNumbers(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment]);

  //for RO-TE
  useEffect(() => {
    if (office_type !== "HO") {
      dispatch(
        fetchDepartments({
          input_folder: `/ECM CONFIG/Office Type/${office_type}/${userProfile?.properties?.location}`,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //notesheet viewer
  useEffect(() => {
    if (!notesheetPreview) return;

    const fetchPreview = async () => {
      const values = getValues();
      const { department, natureOfCase, subject, casePriority, fileNumber, disposalLevel, year } = values;

      const body = {
        caseNumber: buildCaseName(department?.value, year),
        departmentName: department?.text,
        subject: subject,
        description: subject,
        hoRo: office_type,
        caseNature: natureOfCase?.text,
        disposalLevel: disposalLevel?.text,
        fileNumber: fileNumber?.value,
        taskPriority: casePriority?.text,
        initiateDate: formatDateOnly(new Date()),
        isHTML: selectedAction === "notesheet",
        notesheet: selectedAction === "notesheet" ? editorContent : base64File,
      };

      try {
        setIsCreatingCase(true);
        const response = await axiosInstance.post(ServiceUrl.notesheetPreview, body, { responseType: "blob" });
        const url = URL.createObjectURL(response.data);
        setPreviewData(url);
        setIsCreatingCase(false);
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch {
        setIsCreatingCase(false);
      }
    };

    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesheetPreview]);

  // Convert to Base64 whenever selectedFile changes
  useEffect(() => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (result) {
        // Remove the prefix (everything before the comma)
        const parts = result.split(",");
        if (parts.length > 1) {
          setBase64File(parts[1]);
        }
      }
    };
    reader.readAsDataURL(selectedFile);

    return () => {
      setBase64File(""); // cleanup
    };
  }, [selectedFile]);

  const isShowLoading = loading || isCreatingCase;

  return (
    <Layout notesheetPreview={notesheetPreview}>
      <h6 className="case-title-h6 mb-2">Create Case</h6>

      <div className="main-container d-flex flex-column">
        {isShowLoading && (
          <div className="k-loading-mask">
            <div className="k-loading-image"></div>
          </div>
        )}

        <form>
          <div className="row">
            {/* Department from user details */}
            <FormDropdownField
              name="department"
              label="Department"
              control={control}
              rules={{ required: "Please select a Department." }}
              data={office_type === "HO" ? departments : departmentNames}
              errors={errors}
              onChange={(e) => {
                setChangeDropdown(true);
                setSelectedDepartment(e.value);
              }}
            />

            {/* Division/Vertical selection */}
            {office_type === "HO" && (
              <FormDropdownField
                name="division"
                label="Vertical"
                control={control}
                rules={{ required: "Please select a vertical." }}
                data={vertical}
                errors={errors}
                disabled={selectedDepartment === null}
              />
            )}

            {/* Language selection */}
            <FormDropdownField name="caseLanguage" label="Language" control={control} rules={{ required: "Please select a Language." }} data={languages} errors={errors} />

            {/* Case Types */}
            <FormDropdownField name="caseType" label="Case Type" control={control} rules={{ required: "Please select a case type." }} data={caseTypes} errors={errors} />

            {/* Case priority */}
            <FormDropdownField
              name="casePriority"
              label="Case Priority"
              control={control}
              rules={{ required: "Please select case priority." }}
              data={casePriority}
              errors={errors}
              disabled={selectedDepartment === null}
            />

            {/* Nature of case */}
            <FormDropdownField
              name="natureOfCase"
              label="Nature of Case"
              control={control}
              rules={{ required: "Please select case nature." }}
              data={natureOfCase}
              errors={errors}
            />

            {/* year */}
            <div className="col-xs-12 col-sm-6 col-md-4">
              <Label className="case-form-label">Year</Label>
              <Controller name="year" control={control} render={({ field }) => <Input readOnly value={field.value} className="case-form-dropdown" />} />
            </div>

            {/* File numbers */}
            <div className="col-xs-12 col-sm-6 col-md-4">
              <div>
                <Label className="case-form-label">
                  File Number <span className="required-asterisk">*</span>
                </Label>
                <Controller
                  name="fileNumber"
                  control={control}
                  rules={{ required: "Please select a file number." }}
                  render={({ field }) => (
                    <div className="input-group">
                      <Input readOnly value={field.value?.value || ""} className="custom-input input-border" />
                      <button type="button" className="border input-group-append" onClick={() => setFileNoPop((prev) => !prev)} aria-label="Select file number">
                        <IoFileTrayFull size={20} />
                      </button>
                    </div>
                  )}
                />
                {errors.fileNumber && <div className="form-error">{errors.fileNumber.message}</div>}
              </div>
            </div>

            {/* Disposal level */}
            <FormDropdownField
              name="disposalLevel"
              label="Disposal Level"
              control={control}
              rules={{ required: "Please select a disposal level." }}
              data={getDisposalLevels(office_type)}
              errors={errors}
            />

            {/* Subject */}
            <div className="col-md-12">
              <Label className="case-form-label">
                Subject <span className="required-asterisk">*</span> <span className="font-size-10 text-secondary">(max length should be 250 characters)</span>
              </Label>
              <Controller
                name="subject"
                control={control}
                rules={{ required: "Please enter a subject." }}
                render={({ field }) => <TextArea rows={2} maxLength={250} value={field.value} className="case-form-dropdown" onChange={(e) => field.onChange(e.value)} />}
              />
              {errors.subject && <div className="form-error">{errors.subject.message}</div>}
            </div>

            {/* case action */}
            <div className="col-md-12">
              <CaseAction
                tab={selectedAction}
                selectedFile={selectedFile}
                createdNotesheet={createdNotesheet}
                setTab={handleSelectTab}
                handleFileUpload={handleFileUpload}
                openEditor={() => setIsNotesheetDialogOpen(true)}
                previewNotesheet={() => setIsNotesheetDialogOpen((prev) => !prev)}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end mt-3 gap-2">
            <Button type="button" className="common-btn-css cancel-button" onClick={handleResetForm} disabled={false}>
              RESET
            </Button>
            <Button type="button" disabled={!isPreviewEnabled} className="common-btn-css submit-button" onClick={() => setNotesheetPreview(true)}>
              Preview Notesheet
            </Button>
          </div>
        </form>

        {isNotesheetDialogOpen && (
          <Dialog title="Notesheet" className="notesheet-window-editor" onClose={() => setIsNotesheetDialogOpen(false)}>
            <RichTextEditor value={editorContent} onChange={onEditorChange} />

            <div className="d-flex justify-content-end mt-3 gap-2">
              <Button className="common-btn-css cancel-button" onClick={() => setIsNotesheetDialogOpen(false)}>
                CLOSE
              </Button>
              <Button
                onClick={() => {
                  setCreatedNotesheet(true);
                  setIsNotesheetDialogOpen(false);
                }}
                className="common-btn-css submit-button"
                disabled={!hasValidEditorContent(editorContent)}
              >
                SAVE
              </Button>
            </div>
          </Dialog>
        )}

        {fileNoPop && (
          <FileNumberDialog
            open={fileNoPop}
            fileNumbers={fileNumbers}
            onClose={() => setFileNoPop(false)}
            selectedFileNumber={selectedFileNumber}
            onSelectFileNumber={(fileNumber) => {
              setSelectedFileNumber(fileNumber);
              setValue("fileNumber", fileNumber);
            }}
            isLoading={loading}
            paginationTotal={fileNumbersPagination.total}
            onFetch={(page, filters) => {
              const params = {
                input_ho_ro: office_type,
                input_dept_short_code: selectedDepartment?.value || department_short_code,
                ...(office_type !== "HO" && { input_ro_short_code: ro_short_code }),
                page,
                "items-per-page": fileNumbersPagination.itemsPerPage,
                ...filters,
              };
              dispatch(fetchFileNumbers(params));
            }}
          />
        )}

        {notesheetPreview && (
          <Dialog title="Notesheet Preview" className="notesheet-preview-dialog-wh" onClose={() => setNotesheetPreview(false)}>
            {isCreatingCase && (
              <div className="k-loading-mask">
                <div className="k-loading-image"></div>
              </div>
            )}

            <div className="preview-image-container">
              <img src={previewData} alt="Notesheet Preview" className="w-100 h-auto" />
            </div>

            <div className="d-flex justify-content-end mt-2">
              <Button className="common-btn-css cancel-button me-2" onClick={() => setNotesheetPreview(false)}>
                Cancel
              </Button>
              <Button className="common-btn-css submit-button" disabled={isCreatingCase} type="submit" onClick={handleCreateCase}>
                CREATE
              </Button>
            </div>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
