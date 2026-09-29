import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

//components
import Layout from "../../../components/layout/Layout";
import DigidakAction from "../../../components/digidakAction/DigidakAction";
import RichTextEditor from "../../../components/richTextEditor/RichTextEditor";

// Kendo UI
import { process } from "@progress/kendo-data-query";
import { Label } from "@progress/kendo-react-labels";
import { Input } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { DatePicker } from "@progress/kendo-react-dateinputs";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { validateFileSignature } from "../../../utils/validateFileSignature";

// react-hook-form
import { Controller, useForm } from "react-hook-form";

// React Icons
import { FaDownload, FaTrash } from "react-icons/fa6";

//sweet alert
import Swal from "sweetalert2";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { createDigidakInward, fetchDigidakGroups, provideDigidakPermission } from "../../../redux/digidak/inward/digidakInwardSlice";
import { toKendoDate, getFinancialYear } from "../../../utils/Utils";
import { useInwardDropdownFields } from "../../../hooks/useInwardDropdownFields";
import { useDigidakDocumentActions } from "../../../hooks/useDigidakDocumentActions";
import ActionButton from "../../../components/actionButton/ActionButton";

const InwardEntry = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { loading: inwardLoading } = useSelector((state) => state.digidakInward);
  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, object_name } = userProfile?.properties || {};
  const { location: userLocation } = userProfile?.properties || {};

  const { sourceVerticalData } = useSelector((state) => state.digidakDropdown);

  const { handleDownload, handleDelete } = useDigidakDocumentActions();
  const { fields: dropdownFields, isDDM } = useInwardDropdownFields();

  const copiedData = location.state?.copiedData;

  const [showDialog, setShowDialog] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState({
    objectId: "",
    uidNumber: "",
    folderPath: "",
  });
  const [selectedAction, setSelectedAction] = useState("upload");
  const [editorContent, setEditorContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [documentList, setDocumentList] = useState([]);
  const [processedGridData, setProcessedGridData] = useState([]);
  const [loader, setLoader] = useState(false);
  const [showUploadPop, setShowUploadPop] = useState(false);
  const [previewNotePop, setPreviewNotePop] = useState(false);
  const [createdNotesheet, setCreatedNotesheet] = useState(false);
  const [isNotesheetDialogOpen, setNotesheetDialogOpen] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
    setValue,
    getValues,
  } = useForm({
    mode: "onChange",
    defaultValues: {
      receivedFrom: "",
      senderAddress: "",
      taskCategory: "Information",
      priority: "",
      secrecy: "Regular",
      language: "",
      referenceNumber: "",
      subject: "",
      stateOfSender: "",
      date: new Date(),
      modeOfReceipt: "",
      documentType: "upload",
      uploadedFile: null,
      type: "External",
      sourceVertical: "",
    },
  });

  // Prefill stateOfSender for DDM users
  useEffect(() => {
    // Only prefill for DDM and fresh entry (not copy / draft)
    if (isDDM && userLocation && !copiedData?.id) {
      setValue("stateOfSender", userLocation);
    }
  }, [isDDM, userLocation, copiedData?.id, setValue]);

  const findSourceVerticalOption = (value, sourceVerticalData) => {
    if (!value || !Array.isArray(sourceVerticalData)) return "";
    return sourceVerticalData.find((opt) => opt.value === value) || "";
  };

  // Prefill form if copiedData is passed from inbox page
  useEffect(() => {
    if (!copiedData) return;

    if (copiedData?.id || copiedData?.uid_number || copiedData?.r_folder_path) {
      setGeneratedNumber((prev) => ({
        ...prev,

        objectId: copiedData?.id || "",
        uidNumber: copiedData?.uid_number || "",
        folderPath: copiedData?.r_folder_path || "",
      }));
    }

    // uid Number
    if (copiedData?.uid_number) {
      setIsGenerated(true);
    }

    // reset
    reset({
      receivedFrom: copiedData?.receivedFrom || "",
      senderAddress: copiedData?.senderAddress || "",
      taskCategory: copiedData?.taskCategory || "Information",
      priority: copiedData?.priority || "",
      secrecy: copiedData?.secrecy || "Regular",
      language: copiedData?.language || "",
      referenceNumber: copiedData?.referenceNumber || "",
      subject: copiedData?.subject || "",
      stateOfSender: copiedData?.stateOfSender || "",
      date: copiedData?.date ? toKendoDate(copiedData?.date) : new Date(),
      modeOfReceipt: copiedData?.modeOfReceipt || "",
      documentType: copiedData?.documentType || "upload",
      uploadedFile: copiedData?.uploadedFile || null,
      type: copiedData?.type || "External",

      sourceVertical: findSourceVerticalOption(copiedData?.inward_vertical, sourceVerticalData),
    });
  }, [copiedData, reset, sourceVerticalData]);

  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: 50,
    filter: null,
  });

  const handleDataStateChange = useCallback((e) => {
    setDataState(e.dataState);
  }, []);
  const handleOpenNotesheetEditor = () => {
    setNotesheetDialogOpen(true);
  };
  const handlePreviewNotesheet = () => {
    setPreviewNotePop((prev) => !prev);
  };
  const handleSelectTab = (tab) => {
    setSelectedAction(tab);
    if (tab === "notesheet") {
      setSelectedFile(null);
    } else {
      setEditorContent("");
      setCreatedNotesheet(false);
    }
  };
  const onEditorChange = (event) => {
    setEditorContent(event.html);
  };
  const hasValidEditorContent = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent.trim()?.length > 0;
  };
  const handleSaveNotesheet = () => {
    setCreatedNotesheet(true);
    setNotesheetDialogOpen(false);
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = [".doc", ".docx"];
    const dotIndex = file.name.lastIndexOf(".");
    if (dotIndex === -1) {
      showSweetAlert({ title: `Only the following formats are allowed: ${allowedExtensions.join(", ")}`, icon: "warning" });
      e.target.value = "";
      return;
    }
    const fileExtension = file.name.substring(dotIndex)?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      showSweetAlert({ title: `Only the following formats are allowed: ${allowedExtensions.join(", ")}`, icon: "warning" });
      e.target.value = "";
      return;
    }

    // Validate file content matches its extension (detect renamed files)
    const signatureResult = await validateFileSignature(file);
    if (!signatureResult.valid) {
      showSweetAlert({ title: signatureResult.message, icon: "warning" });
      e.target.value = "";
      return;
    }

    if (!isGenerated) {
      showSweetAlert({ title: "Please generate an Inward Number before adding documents.", icon: "warning" });
      e.target.value = "";
      return;
    }

    const newFile = {
      id: crypto.randomUUID(),
      fileName: file.name,
      fileObj: file,
      document_type: "File Upload",
    };

    setUploadedFiles((prev) => [newFile, ...prev]);
    setSelectedFile(file);
    e.target.value = "";
  };
  const FormDropdownField = ({ name, label, data }) => {
    const isObjectData = data?.length && typeof data[0] === "object";

    return (
      <div className="col-xs-12 col-sm-4 col-md-3">
        <Label className="case-form-label">
          {label} <span className="required-asterisk">*</span>
        </Label>
        <Controller
          name={name}
          control={control}
          rules={{ required: `${label} is required` }}
          render={({ field }) => (
            <DropDownList
              className="case-form-dropdown"
              data={data}
              value={field.value}
              onChange={(e) => field.onChange(e.value)}
              disabled={isGenerated}
              textField={isObjectData ? "text" : undefined}
              dataItemKey={isObjectData ? "value" : undefined}
            />
          )}
        />
        {errors[name] && <div className="form-error">{errors[name].message}</div>}
      </div>
    );
  };
  const fileActionCell = (props) => {
    const data = props.dataItem;

    return (
      <td className="d-flex gap-2">
        <ActionButton onClick={() => handleDownload(data)} icon={FaDownload} title="Download" />
        <ActionButton
          onClick={() =>
            handleDelete(data, async () => {
              // onSuccess callback: Refetch documents
              const refetchResponse = await digidakInwardService.getInwardDocuments({
                input_parent_folders: generatedNumber?.objectId,
              });
              setDocumentList(refetchResponse?.entries || []);
            })
          }
          icon={FaTrash}
          title="Delete"
        />
      </td>
    );
  };
  const handleUpdateDocumentList = (newList) => {
    setDocumentList(newList);
  };
  const handleFilesAddedToGrid = useCallback(
    async (filesWithTypes) => {
      setShowUploadPop(true);
      setLoader(true);

      try {
        const uploaded = [];

        // Loop through selected files
        for (const item of filesWithTypes) {
          const file = item.file;

          // Step 1: Get upload path
          const uploadRes = await documentService.getFilePath(file);

          const fileSrc = uploadRes?.entries?.[0]?.content?.src;
          if (!fileSrc) throw new Error(`File upload failed for ${file.name}`);

          // Step 2: Prepare upload payload
          const uploadPayload = {
            properties: {
              a_content_type: "msw12",
              r_object_type: "cms_digidak_document",
              object_name: file.name,
              folder_id: generatedNumber?.objectId,
            },
            type: "cms_digidak_document",
            source: fileSrc,
          };

          // Step 3: Upload document
          await documentService.uploadDocument(uploadPayload);

          // Step 4: Get documents
          const response = await digidakInwardService.getInwardDocuments({
            input_parent_folders: generatedNumber?.objectId,
          });

          setDocumentList(response?.entries);
        }

        setLoader(false);

        // Step 4: Add all uploaded files together
        if (uploaded.length > 0) {
          setUploadedFiles((prev) => [...prev, ...uploaded]);

          showSweetAlert({
            title: "Upload Successful",
            text: uploaded.length === 1 ? `${uploaded[0].fileName} uploaded successfully!` : `${uploaded.length} files uploaded successfully!`,
            icon: "success",
          });
        }
      } catch (error) {
        setLoader(false);
        showSweetAlert({
          title: "Upload Failed",
          text: error.message || "Failed to upload file(s). Please try again.",
          icon: "error",
        });
        return;
      }
    },
    [generatedNumber?.objectId],
  );

  const handleGenerate = async () => {
    const formValues = getValues();
    setIsGenerated(true);

    const formattedDate = formValues.date ? new Date(formValues.date).toISOString() : new Date().toISOString();

    const financialYear = getFinancialYear();

    const formData = {
      in_address_of_sender: formValues.senderAddress || "",
      in_decision: "Inward",
      in_entry_date: formattedDate,
      in_entry_type: formValues.type || "External",
      in_financial_year: financialYear,
      in_inward_ref_number: formValues.referenceNumber || "",
      in_languages: formValues.language || "",
      in_letter_subject: formValues.subject || "",
      in_login_user: object_name || "",
      in_mode_of_receipt: formValues.modeOfReceipt || "",
      in_office_type: office_type || "",
      in_priority: formValues.priority || "",
      in_received_from: formValues.receivedFrom || "",
      in_secrecy: formValues.secrecy || "",
      in_state_of_sender: formValues.stateOfSender || "",
      in_type_category: formValues.taskCategory || "",
      in_inward_letter: isDDM ? "" : formValues?.sourceVertical?.value || "",
      ...(isDDM && { is_ddm: true }),
    };

    const result = await dispatch(createDigidakInward(formData));

    if (createDigidakInward.fulfilled.match(result)) {
      const data = result.payload.data.packages.digidak_folder.href;
      const objectId = data.substring(data.lastIndexOf("/") + 1);
      setLoader(true);
      setShowDialog(false);

      const response = await digidakInwardService.getDigidakInwardGridData({
        input_object_id: objectId,
        "items-per-page": 300,
      });

      setLoader(false);
      setProcessedGridData(response?.entries);
      setGeneratedNumber({
        objectId: response?.entries?.[0]?.content?.properties?.id,
        uidNumber: response?.entries?.[0]?.content?.properties?.uid_number,
        folderPath: response?.entries?.[0]?.content?.properties?.r_folder_path?.[0],
      });
    } else {
      setIsGenerated(false);
    }
  };

  // Fetch documents based on navigation location data
  useEffect(() => {
    if (!copiedData?.id) return;

    const fetchDigidakInwardGridData = async () => {
      try {
        setLoader(true);
        const response = await digidakInwardService.getDigidakInwardGridData({
          input_object_id: copiedData.id,
          "items-per-page": 300,
        });
        setLoader(false);
        setProcessedGridData(response?.entries);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchInwardDocuments = async () => {
      try {
        const response = await digidakInwardService.getInwardDocuments({
          input_parent_folders: copiedData.id,
        });

        setDocumentList(response?.entries);
      } catch (error) {
        console.error(error);
      }
    };
    if (copiedData?.fromProps === "draft-screen") {
      fetchDigidakInwardGridData();
      fetchInwardDocuments();
    }
  }, [copiedData]);

  const onSubmit = async () => {
    try {
      setLoader(true);

      if (!generatedNumber?.objectId) return;

      const folderId = generatedNumber.objectId;
      const formValues = getValues();

      // DDM users follow a different flow: no group checks, mark as Unread and include is_ddm
      if (isDDM) {
        const response = await dispatch(
          provideDigidakPermission({
            folderId,
            status: "Unread",
            extra: {
              is_ddm: true,
              in_login_user: object_name,
            },
          }),
        );

        if (response?.payload?.name === "process") {
          navigate("/digidak-inbox");
        }

        // Completed DDM flow
        return;
      }

      const groupName = formValues?.sourceVertical?.value;

      // Call Groups API
      const groupRes = await dispatch(
        fetchDigidakGroups({
          loginUser: object_name,
          groupName: groupName,
          flag: "inwardvertical",
        }),
      );

      if (!groupRes?.payload?.data?.variables) {
        throw new Error("Failed to fetch group details.");
      }

      const groupVars = groupRes?.payload?.data?.variables;

      // Extract required fields
      const verticalHeadDisplay = groupVars.group_display_name?.[0] || "";
      const verticalHeadGroupName = groupVars.group_names?.[0] || "";

      if (!verticalHeadDisplay || !verticalHeadGroupName) {
        throw new Error("Vertical Head group not found.\nPlease contact your local administrator.");
      }

      // Call Permission API with full dynamic data
      const response = await dispatch(
        provideDigidakPermission({
          folderId,
          status: "Assigned Head",
          extra: {
            in_vertical_head_display_name: verticalHeadDisplay,
            in_vertical_head_group_name: verticalHeadGroupName,
            in_login_user: object_name,
          },
        }),
      );

      // Redirect on success
      if (response?.payload?.name === "process") {
        navigate("/digidak-inbox");
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Unexpected error occurred.",
      });
    } finally {
      setLoader(false);
    }
  };

  const mappedData = useMemo(() => {
    return (
      processedGridData?.map((item) => {
        const { uid_number, r_creator_name, received_from, selected_region, status } = item?.content?.properties ?? {};

        return {
          digidak_uid: uid_number,
          recipient: r_creator_name,
          sender: received_from,
          selected_region: selected_region,
          status: status,
        };
      }) ?? []
    );
  }, [processedGridData]);

  const docMappedData = useMemo(() => {
    return (
      documentList?.map((item) => {
        const { id, object_name, owner_name, document_type, r_creator_name, r_creation_date } = item?.content?.properties ?? {};

        return {
          doc_id: id,
          doc_name: object_name,
          owner_name: owner_name,
          document_type: document_type || "",
          r_creator_name: r_creator_name,
          r_creation_date: r_creation_date,
        };
      }) ?? []
    );
  }, [documentList]);

  const processedData = useMemo(() => process(mappedData, dataState), [mappedData, dataState]);
  const processedDocData = useMemo(() => process(docMappedData, dataState), [docMappedData, dataState]);

  return (
    <Layout screenName={"inwardEntry"} showUploadPop={showUploadPop}>
      {loader && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between my-2">
        <h6 className="case-title-h6">Add New Inward</h6>
        <div className="d-flex align-items-center gap-2">{generatedNumber?.uidNumber && <h6 className="case-title-h7">UID : {generatedNumber?.uidNumber}</h6>}</div>
      </div>

      <div className="main-container">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-xs-12 col-sm-4 col-md-3">
              <Label className="case-form-label">Type:</Label>
              <Controller name="type" control={control} render={({ field }) => <Input readOnly value={field.value} onChange={(e) => field.onChange(e.value)} />} />
            </div>
            <FormDropdownField {...dropdownFields.find((f) => f.name === "taskCategory")} />
            <div className="col-xs-12 col-sm-4 col-md-3">
              <Label className="case-form-label">
                Address of Sender <span className="required-asterisk">*</span>
              </Label>
              <Controller
                name="senderAddress"
                control={control}
                rules={{ required: "Address of Sender is required" }}
                render={({ field }) => (
                  <Input autoComplete="off" className="case-form-dropdown input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />
                )}
              />
            </div>
            <FormDropdownField {...dropdownFields.find((f) => f.name === "stateOfSender")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "receivedFrom")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "priority")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "secrecy")} />
            <FormDropdownField {...dropdownFields.find((f) => f.name === "language")} />

            <div className="col-xs-12 col-sm-4 col-md-3">
              <Label className="case-form-label">
                Inward Reference Number <span className="required-asterisk">*</span>
              </Label>
              <Controller
                name="referenceNumber"
                control={control}
                rules={{ required: "Inward Reference Number is required" }}
                render={({ field }) => (
                  <Input autoComplete="off" className="case-form-dropdown input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />
                )}
              />
            </div>

            <div className="col-xs-12 col-sm-12 col-md-6">
              <Label className="case-form-label">
                Subject of Letter <span className="required-asterisk">*</span>
              </Label>
              <Controller
                name="subject"
                control={control}
                rules={{ required: "Subject is required" }}
                render={({ field }) => (
                  <Input autoComplete="off" className="case-form-dropdown input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />
                )}
              />
            </div>

            <div className="col-xs-12 col-sm-4 col-md-3">
              <Label className="case-form-label">Date</Label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    className="input-border"
                    placeholder="Choose a date..."
                    value={field.value}
                    onChange={(e) => field.onChange(e.value)}
                    disabled={isGenerated}
                    max={new Date()}
                    format="dd/MM/yyyy"
                  />
                )}
              />
            </div>

            <FormDropdownField {...dropdownFields.find((f) => f.name === "modeOfReceipt")} />
            {!isDDM && <FormDropdownField {...dropdownFields.find((f) => f.name === "sourceVertical")} />}
            <div className="w-100"></div>
            <div className="col-md-6">
              <DigidakAction
                loader={loader}
                tab={selectedAction}
                screenName="inwardEntry"
                setTab={handleSelectTab}
                isGenerated={isGenerated}
                selectedFile={selectedFile}
                uploadedFiles={uploadedFiles}
                documentListData={documentList}
                handleFileUpload={handleFileUpload}
                createdNotesheet={createdNotesheet}
                objectId={generatedNumber?.objectId}
                uidNumber={generatedNumber?.uidNumber}
                openEditor={handleOpenNotesheetEditor}
                previewNotesheet={handlePreviewNotesheet}
                onDocumentListUpdate={handleUpdateDocumentList}
                handleFilesAddedToGrid={handleFilesAddedToGrid}
              />
            </div>

            <div className="col-md-6 d-flex flex-column min-height-100 mt-2 mt-md-0">
              <div className="d-flex justify-content-end mt-auto gap-2">
                <Button onClick={() => setShowDialog(true)} className="common-btn-css approve-button" disabled={!isValid || isGenerated}>
                  Generate Inward Number
                </Button>
                <Button className="common-btn-css submit-button" type="submit" disabled={!isGenerated || documentList.length === 0}>
                  Inward
                </Button>
              </div>
            </div>
          </div>
        </form>

        {isNotesheetDialogOpen && (
          <Dialog title="Notesheet" className="notesheet-window-editor" onClose={() => setNotesheetDialogOpen(false)}>
            <RichTextEditor value={editorContent} onChange={onEditorChange} />
            <div className="d-flex justify-content-end mt-3 gap-2">
              <Button className="common-btn-css cancel-button" onClick={() => setNotesheetDialogOpen(false)}>
                CLOSE
              </Button>
              <Button onClick={handleSaveNotesheet} className="common-btn-css submit-button" disabled={!hasValidEditorContent(editorContent)}>
                SAVE
              </Button>
            </div>
          </Dialog>
        )}

        {showDialog && (
          <Dialog title="Letter Confirmation Message" onClose={() => setShowDialog(false)} className="custom-dialog-width">
            <p>You will not be able to modify the entered data after generating the Inward number</p>
            <DialogActionsBar>
              <div className="d-flex justify-content-end gap-2">
                <Button onClick={() => setShowDialog(false)} className="common-btn-css cancel-button">
                  Cancel
                </Button>
                <Button onClick={handleGenerate} className="common-btn-css submit-button" disabled={inwardLoading}>
                  {inwardLoading ? "Generating..." : "Generate"}
                </Button>
              </div>
            </DialogActionsBar>
          </Dialog>
        )}

        <div className="row mt-3 g-1">
          <div className="col-md-6">
            <div className="inward-table-container bg-white">
              <Grid
                {...dataState}
                data={processedDocData}
                sortable={true}
                resizable={true}
                pageable={{
                  info: true,
                  buttonCount: 10,
                  pageSizes: false,
                }}
                onDataStateChange={handleDataStateChange}
              >
                <GridColumn field="doc_name" title="File Name" />
                <GridColumn field="document_type" title="Document Type" />
                <GridColumn width="100px" title="Action" cells={{ data: fileActionCell }} />
              </Grid>
            </div>
          </div>
          <div className="col-md-6">
            <div className="inward-table-container bg-white">
              <Grid
                {...dataState}
                data={processedData}
                sortable={true}
                resizable={true}
                pageable={{
                  info: true,
                  buttonCount: 10,
                  pageSizes: false,
                }}
                onDataStateChange={handleDataStateChange}
              >
                <GridColumn field="digidak_uid" title="Digidak UID" />
                <GridColumn field="sender" title="Sender" />
                <GridColumn field="recipient" title="Recipient" />
                <GridColumn field="selected_region" title="Dept/RO/TE" />
                <GridColumn field="status" title="Status" />
              </Grid>
            </div>
          </div>
        </div>

        {previewNotePop && (
          <Dialog title="Notesheet Preview" className="notesheet-window-editor" onClose={() => setPreviewNotePop(false)}>
            <RichTextEditor value={editorContent} />
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default InwardEntry;
