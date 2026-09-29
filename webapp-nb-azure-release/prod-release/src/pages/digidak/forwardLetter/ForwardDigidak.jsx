import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

// Routing
import { useLocation, useNavigate } from "react-router-dom";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchDigidakFolderDetails, clearFolderDetails } from "../../../redux/digidak/folder/digidakFolderSlice";
import { createDigidakOutward, provideDigidakPermission } from "../../../redux/digidak/outward/digidakOutwardSlice";
import { fetchDigidakDropdown } from "../../../redux/digidak/dropdowns/digidakDropdownSlice";

// Kendo UI components and data utilities
import { Input } from "@progress/kendo-react-inputs";
import { Label } from "@progress/kendo-react-labels";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Button } from "@progress/kendo-react-buttons";
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { process } from "@progress/kendo-data-query";

// Icon assets
import { IoArrowBackOutline, IoFileTrayFull } from "react-icons/io5";
import { FaDownload } from "react-icons/fa6";

// Shared layout and reusable UI components
import Layout from "../../../components/layout/Layout";
import InfoFieldsDisplay from "../../../components/infoFieldsDisplay/InfoFieldsDisplay";
import FileNumberDialog from "../../../components/fileNumberDialog/FileNumberDialog";
import RecipientSelector from "../../../components/OutwardRecipientSelector/RecipientSelector";
import ActionButton from "../../../components/actionButton/ActionButton";

// Custom hooks
import { useFileNumbers } from "../../../hooks/useFileNumbers";
import { useDigidakDocumentActions } from "../../../hooks/useDigidakDocumentActions";

// API services
import { digidakInwardService } from "../../../services/digidak/inward/digidakInwardService";

// Utility helpers
import { typeData } from "../../data/DropdownData";
import { getFinancialYear } from "../../../utils/Utils";

const ForwardDigidak = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const hasFetchedRef = useRef(false);

  const { digidakObjectId } = location.state || {};

  useEffect(() => {
    if (!digidakObjectId) {
      navigate("/digidak-inbox", { replace: true });
    }
  }, [digidakObjectId, navigate]);

  const { fileNumbers, fileNumbersPagination, fileNumbersLoading, fetchFileNumbersPage } = useFileNumbers();

  const { userProfile } = useSelector((state) => state?.login);
  const { office_type, object_name: userName } = userProfile?.properties || {};

  const { folderDetails, loading: folderLoading } = useSelector((state) => state.digidakFolder);
  const props = folderDetails?.content?.properties || {};

  const { dropdownData, sourceVerticalData } = useSelector((state) => state.digidakDropdown);

  const { type_category = [], state_of_sender: state_of_recipient = [], received_from: category_external = [] } = dropdownData || {};

  const { loading: generateLoading } = useSelector((state) => state.digidakOutward);

  const [isGenerated, setIsGenerated] = useState(false); // Generate
  const [documentList, setDocumentList] = useState([]); // Uploaded files
  const [processedGridData, setProcessedGridData] = useState([]); // After generation
  const [isFileNumberDialogOpen, setIsFileNumberDialogOpen] = useState(false); // File Number
  const [selectedFileNumber, setSelectedFileNumber] = useState(null); // File Number
  const [showDialog, setShowDialog] = useState(false); // Confirmation Dialog
  const [loader, setLoader] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState({
    objectId: "",
    uidNumber: "",
    folderPath: "",
  });

  // Form Initialization
  const {
    handleSubmit,
    control,
    setValue,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      type: "Internal",
      taskCategory: "Information",
      remarks: "",
      sourceVertical: "",
      fileNumber: "",
      sendingBulkLetter: false,
      // External
      categoryExternal: "",
      recipientAddress: "",
      stateOfRecipient: "",

      // additional fields
      ro: "", // office type
      department: "", // selected recipient
      ros: [], // office type (bulk)
      departments: [], // selected recipients (bulk)
    },
  });

  // Watch form fields
  const type = useWatch({ control, name: "type" });

  // Prefill required data
  useEffect(() => {
    if (props?.forward_letter_object_id) return;
    if (!digidakObjectId) return;
    if (!props) return;

    const sourceVertical = props.source_vertical?.[0];
    const mappedSrcVertical = sourceVerticalData?.find((opt) => opt.value === sourceVertical || opt.text === sourceVertical);

    const currentValues = getValues();

    const needReset =
      (mappedSrcVertical?.value || mappedSrcVertical?.text) !== (currentValues?.sourceVertical?.value || currentValues?.sourceVertical?.text) ||
      currentValues?.type !== props.entry_type ||
      currentValues?.taskCategory !== props.type_category;

    if (needReset) {
      reset({
        ...currentValues,
        sourceVertical: mappedSrcVertical,
        type: props.entry_type,
        taskCategory: props.type_category,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digidakObjectId, props, sourceVerticalData]);

  useEffect(() => {
    if (!digidakObjectId) return;

    dispatch(clearFolderDetails());

    hasFetchedRef.current = false;

    if (hasFetchedRef.current) return;

    dispatch(fetchDigidakFolderDetails({ input_object_id: digidakObjectId }));
    hasFetchedRef.current = true;

    return () => {
      dispatch(clearFolderDetails());
      hasFetchedRef.current = false;
    };
  }, [digidakObjectId, dispatch]);

  // Information fields
  const infoFields = [
    {
      label: "Subject",
      value: props.letter_subject,
    },
    {
      label: "Sender",
      value: props.initiator || props.owner_name,
    },
    {
      label: "Receiver",
      value: props.selected_region,
    },
    {
      label: "Date & Time",
      value: props.r_creation_date
        ? new Date(props.r_creation_date).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    },
    {
      label: "Status",
      value: props.status,
    },
    {
      label: "DigiDak No",
      value: props.uid_number,
    },
  ];

  // Dropdown fields
  const dropdownFields = [
    { name: "type", label: "Type", data: typeData.map((item) => item.text) },
    {
      name: "taskCategory",
      label: "Task Category",
      data: type_category.map((item) => item.text),
    },
    {
      name: "sourceVertical",
      label: "Source Vertical",
      data: sourceVerticalData,
    },
    {
      name: "categoryExternal",
      label: "Category",
      data: category_external.map((item) => item.text),
    },
    {
      name: "stateOfRecipient",
      label: "State of Recipient",
      data: state_of_recipient.map((item) => item.text),
    },
  ];

  // Reusable Dropdown Component
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

  // Grid Data
  const [dataState, setDataState] = useState({
    sort: [{ field: "id", dir: "asc" }],
    skip: 0,
    take: 50,
    filter: null,
  });

  const handleDataStateChange = useCallback((e) => {
    setDataState(e.dataState);
  }, []);

  // Map grid data (after generation)
  const mappedData = useMemo(() => {
    return (
      processedGridData?.map((item) => {
        const props = item?.content?.properties ?? {};

        return {
          digidak_uid: props.uid_number,
          forwarded_uid: props.forward_group_uid,
          recipient: props.r_creator_name,
          selected_region: props.selected_region,
          status: props.status,
        };
      }) ?? []
    );
  }, [processedGridData]);

  const docMappedData = useMemo(() => {
    return (
      documentList?.map((item) => {
        const props = item?.content?.properties ?? {};

        return {
          doc_id: props.id,
          doc_name: props.object_name,
          owner_name: props.owner_name,
          document_type: props.document_type || "",
          r_creator_name: props.r_creator_name,
          r_creation_date: props.r_creation_date,
        };
      }) ?? []
    );
  }, [documentList]);

  const processedDocData = useMemo(() => process(docMappedData, dataState), [docMappedData, dataState]);

  const processedData = useMemo(() => process(mappedData, dataState), [mappedData, dataState]);

  // Payload for type Internal
  const buildInternalPayload = (formValues) => {
    const selectedType = formValues?.ro?.value;
    return {
      in_decision: "Outward",
      in_entry_type: "Internal",
      in_type_category: formValues.taskCategory,
      in_source_vertical: [formValues.sourceVertical?.text],
      in_file_number: formValues.fileNumber?.value || "",
      in_is_bulk_letter: formValues.sendingBulkLetter ? "true" : "false",
      // Login user
      in_login_user: userName,
      in_office_type: office_type,
      in_ho_ro_te: [selectedType],
      in_selected_recipients_single: formValues.department || "",
    };
  };

  const buildExternalPayload = (formValues) => {
    return {
      in_decision: "Outward External",
      in_entry_type: "Internal",
      in_type_category: formValues.taskCategory,
      in_source_vertical: [formValues.sourceVertical?.text],
      in_file_number: formValues.fileNumber?.value || "",
      in_is_bulk_letter: formValues.sendingBulkLetter ? "true" : "false",
      // Login user
      in_login_user: userName,
      in_office_type: office_type,
      // External
      in_received_from: formValues.categoryExternal,
      in_address_of_sender: formValues.recipientAddress || "",
      in_state_of_sender: formValues.stateOfRecipient || "",
    };
  };

  const handleGenerate = async () => {
    setLoader(true);

    try {
      const financialYear = getFinancialYear();
      const formValues = getValues();

      const type = formValues.type;

      const payload = type === "Internal" ? buildInternalPayload(formValues) : buildExternalPayload(formValues);

      let formData = {
        ...payload,
        in_is_forward: true,
        in_remarks: formValues.remarks,
        in_financial_year: financialYear,
        in_is_group: formValues.sendingBulkLetter,
        in_letter_subject: props.letter_subject,
        in_main_letter_id: digidakObjectId || props?.id, // parent letter id

        // required for draft case
        in_draft_office_type: [formValues?.ro?.value || ""],
        in_draft_selected_recipients: [formValues.department || ""],
        in_source_vertical_group_name: [formValues.sourceVertical?.value], // Newly added as per anjani consent
      };

      if (formValues.sendingBulkLetter && type !== "External") {
        formData = {
          ...formData,
          in_decision: "Outward Bulk",
          in_selected_recipients_multi: formValues.departments,
          in_ho_ro_te: formValues.ros,
          in_draft_office_type: formValues.ros,
          in_draft_selected_recipients: formValues.departments,
        };
      }

      /* -------------------- GENERATE FORWARD NUMBER -------------------- */
      const result = await dispatch(createDigidakOutward(formData));

      if (!createDigidakOutward.fulfilled.match(result)) return;

      const href = result.payload?.data?.packages?.digidak_folder?.href;
      const objectId = href?.substring(href.lastIndexOf("/") + 1);

      if (!objectId) return;

      /* -------------------- FETCH FIRST ENTRY -------------------- */
      const firstResponse = await digidakInwardService.getDigidakInwardGridData({
        input_object_id: objectId,
      });

      const firstEntry = firstResponse?.entries?.[0]?.content?.properties || {};

      /* -------------------- DERIVE GROUP UID -------------------- */
      const groupUid = formValues.sendingBulkLetter ? (firstEntry?.uid_number ?? null) : null;

      let finalResponse = firstResponse;

      /* -------------------- FETCH GROUP GRID (BULK ONLY) -------------------- */
      if (formValues.sendingBulkLetter && groupUid) {
        finalResponse = await digidakInwardService.getDigidakInwardGridData({
          input_group_uid: groupUid,
          input_object_id: undefined,
        });
      }

      /* -------------------- 5️⃣ UPDATE GRID DATA -------------------- */
      setProcessedGridData(finalResponse?.entries || []);

      /* -------------------- SET GENERATED NUMBER -------------------- */
      setGeneratedNumber({
        objectId: firstEntry?.id,
        uidNumber: firstEntry?.uid_number,
        folderPath: firstEntry?.r_folder_path?.[0],
      });

      setIsGenerated(true);
      setShowDialog(false);
    } catch {
      setIsGenerated(false);
    } finally {
      setLoader(false);
    }
  };

  // On Submit
  const onSubmit = async () => {
    try {
      setLoader(true);

      if (!generatedNumber?.objectId) return;

      const folderId = generatedNumber.objectId;
      const loginUser = userProfile?.properties?.object_name;
      const formValues = getValues();

      const isExternal = formValues.type === "External";

      let payload;

      /* -------------------- FIRST API PAYLOAD -------------------- */
      if (isExternal) {
        payload = {
          in_flag: "Closed",
          in_login_user: loginUser,
          in_src_verticals: [formValues.sourceVertical?.value],
        };
      } else {
        payload = {
          in_flag: "Unread",
          in_is_group: formValues.sendingBulkLetter,
          in_src_verticals: [formValues.sourceVertical?.value],
        };
      }

      /* -------------------- FIRST API CALL -------------------- */
      const res = await dispatch(
        provideDigidakPermission({
          folderId,
          payload,
        }),
      );

      if (!provideDigidakPermission.fulfilled.match(res)) {
        throw new Error("Forward DigiDak initial permission failed");
      }

      /* -------------------- SECOND API CALL (FINAL FORWARD) -------------------- */
      const forwardPayload = {
        in_flag: "Forward",
        in_login_user: loginUser,
      };

      const res2 = await dispatch(
        provideDigidakPermission({
          folderId: digidakObjectId, // from previous letter
          payload: forwardPayload,
        }),
      );

      if (!provideDigidakPermission.fulfilled.match(res2)) {
        throw new Error("Forward DigiDak final forward failed");
      }

      /* -------------------- NAVIGATION (AFTER SUCCESS) -------------------- */
      navigate("/digidak-inbox", { replace: true });
    } catch (error) {
      console.error(error);
    } finally {
      setLoader(false);
    }
  };

  // Handle back
  const handleBack = () => {
    navigate(-1);
  };

  /* ------------------- HOOKS ------------------- */
  const { handleDownload } = useDigidakDocumentActions();

  // File action cell
  const fileActionCell = (props) => {
    const data = props.dataItem;

    return (
      <td className="d-flex gap-2">
        <ActionButton onClick={() => handleDownload(data)} icon={FaDownload} title="Download" />
      </td>
    );
  };

  // Dropdown api call
  useEffect(() => {
    ["HO", "RO", "TE", "type_category"].forEach((key) => dispatch(fetchDigidakDropdown(key)));
  }, [dispatch]);

  // External-specific dropdowns
  useEffect(() => {
    if (type !== "External") return;
    dispatch(fetchDigidakDropdown("received_from"));
    dispatch(fetchDigidakDropdown("state_of_sender"));
  }, [dispatch, type]);

  // Prefill documents grid
  useEffect(() => {
    if (!folderDetails?.content?.properties) return;

    const props = folderDetails?.content?.properties;

    const objectId = props.id;
    const groupUid = props.group_uid;
    const isBulk = props.group_uid || props.is_external_excel === true;

    // Decide correct parent folder
    const parentFolderToUse = isBulk && groupUid && props?.i_folder_id?.length > 0 ? props.i_folder_id[0] : objectId;

    if (!parentFolderToUse) return;

    const fetchDocuments = async () => {
      try {
        setLoader(true);

        const response = await digidakInwardService.getInwardDocuments({
          input_parent_folders: parentFolderToUse,
        });

        setDocumentList(response?.entries || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoader(false);
      }
    };
    fetchDocuments();
  }, [folderDetails]);

  useEffect(() => {
    if (!folderDetails?.content?.properties?.forward_letter_object_id) return;

    const forwardLetterObjectId = folderDetails?.content?.properties?.forward_letter_object_id;

    const fetchAndPrefill = async () => {
      try {
        setLoader(true);

        // -----------------------------
        // 1️⃣ Initial fetch (objectId)
        // -----------------------------
        const response = await digidakInwardService.getDigidakInwardGridData({
          input_object_id: forwardLetterObjectId,
        });

        let entries = response?.entries || [];

        if (!entries.length) return;

        // -----------------------------
        // Draft data from first entry
        // -----------------------------
        const draftData = entries[0]?.content?.properties || {};

        // -----------------------------
        // 3️⃣ GROUP UID conditional grid handling
        // -----------------------------
        let finalEntries = entries;

        if (draftData?.uid_number && draftData?.is_bulk_letter === "true") {
          const groupResponse = await digidakInwardService.getDigidakInwardGridData({
            input_group_uid: draftData.uid_number,
            input_object_id: undefined,
          });

          finalEntries = groupResponse?.entries || [];
        }

        // Set grid data ONCE (objectId OR groupUid)
        setProcessedGridData(finalEntries);

        // -----------------------------
        // 4️⃣ Map data for form fields
        // -----------------------------
        const isBulk = draftData.group_uid || draftData.is_bulk_letter === "true";

        const sourceVertical = draftData.source_vertical?.[0];
        const mappedSrcVertical = sourceVerticalData?.find((opt) => opt.value === sourceVertical || opt.text === sourceVertical);

        const officeTypes = draftData?.draft_office_type || [];
        const recipients = draftData?.draft_selected_recipients || [];

        const officeType = !isBulk ? officeTypes[0] : "";
        const recipient = !isBulk ? recipients[0] : "";

        // -----------------------------
        // 5️⃣ Prefill form
        // -----------------------------
        const prefillData = {
          type: draftData.entry_type,
          taskCategory: draftData.type_category,
          sourceVertical: mappedSrcVertical,
          fileNumber: draftData.file_number ? { value: draftData.file_number, text: draftData.file_number } : "",
          remarks: draftData.remarks || "",
          sendingBulkLetter: draftData.is_bulk_letter === "true" || false,

          ro: !isBulk && officeType ? { text: officeType, value: officeType } : "",
          department: !isBulk && ["HO", "RO", "TE"].includes(officeType) ? recipient : "",

          ros: isBulk ? officeTypes : [],
          departments: isBulk ? recipients : [],

          // External
          categoryExternal: draftData.received_from,
          recipientAddress: draftData.address_of_sender,
          stateOfRecipient: draftData.state_of_sender,
        };

        reset(prefillData);

        // -----------------------------
        // 6️⃣ Set UID / Generated number
        // -----------------------------
        if (draftData?.id || draftData?.uid_number || draftData?.r_folder_path) {
          setGeneratedNumber((prev) => ({
            ...prev,
            objectId: draftData?.id || "",
            uidNumber: draftData?.uid_number || "",
            folderPath: draftData?.r_folder_path || "",
          }));
        }

        // -----------------------------
        // 7️⃣ Mark as generated
        // -----------------------------
        if (draftData?.uid_number) {
          setIsGenerated(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoader(false);
      }
    };

    fetchAndPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderDetails, sourceVerticalData]);

  return (
    <Layout screenName="forwardLetter">
      {(folderLoading || loader) && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between my-2">
        <div className="d-flex align-items-center gap-2">
          <IoArrowBackOutline
            className="back-icon"
            role="button"
            tabIndex={0}
            aria-label="Go back"
            onClick={handleBack}
            onKeyDown={(e) => e.key === "Enter" && handleBack()}
            title="Go Back"
            color="#fff"
          />
          <h6 className="case-title-h6">Main Digidak</h6>
        </div>
        {generatedNumber?.uidNumber && <h6 className="case-title-h7">UID : {generatedNumber?.uidNumber}</h6>}
      </div>

      {/* Information */}
      <InfoFieldsDisplay fields={infoFields} />

      <div className="main-container main-container--forward">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            {/* Type */}
            <FormDropdownField {...dropdownFields.find((f) => f.name === "type")} />
            {/* Task Category */}
            <FormDropdownField {...dropdownFields.find((f) => f.name === "taskCategory")} />

            {/* Source Vertical */}
            <FormDropdownField {...dropdownFields.find((f) => f.name === "sourceVertical")} />

            {/* File Number */}
            <div className="col-xs-12 col-sm-4 col-md-3">
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
                      <Input readOnly value={field.value?.value || ""} className="custom-input input-border" disabled={isGenerated} />
                      <div className="border input-group-append" onClick={!isGenerated ? () => setIsFileNumberDialogOpen(true) : undefined}>
                        <IoFileTrayFull size={20} cursor="pointer" />
                      </div>
                    </div>
                  )}
                />
                {errors.fileNumber && <div className="form-error">{errors.fileNumber.message}</div>}
              </div>
            </div>

            {type === "External" && (
              <>
                <FormDropdownField {...dropdownFields.find((f) => f.name === "categoryExternal")} />

                {/* Address of Recipient: Input */}
                <div className="col-xs-12 col-sm-4 col-md-3">
                  <Label className="case-form-label">
                    Address of Recipient <span className="required-asterisk">*</span>
                  </Label>
                  <Controller
                    name="recipientAddress"
                    control={control}
                    render={({ field }) => (
                      <Input autoComplete="off" className="case-form-dropdown input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />
                    )}
                  />
                </div>

                <FormDropdownField {...dropdownFields.find((f) => f.name === "stateOfRecipient")} />
              </>
            )}

            {/* Remarks */}
            <div className="col-xs-12 col-sm-12 col-md-6">
              <Label className="case-form-label">
                Remarks <span className="required-asterisk">*</span>
              </Label>
              <Controller
                name="remarks"
                control={control}
                rules={{ required: "Remarks is required" }}
                render={({ field }) => <Input autoComplete="off" className="input-border" value={field.value} onChange={(e) => field.onChange(e.value)} disabled={isGenerated} />}
              />
            </div>

            {/* Select Recipient */}
            {type === "Internal" && (
              <RecipientSelector
                control={control}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
                isGenerated={isGenerated}
                dropdownData={dropdownData}
                verticalOptions={sourceVerticalData}
                disabled={isGenerated}
                responseToDigidakId={false}
              />
            )}

            {/* Force new row for DigidakAction */}
            <div className="w-100"></div>

            <div className="col-md-6"></div>

            {/* Action Buttons */}
            <div className="col-md-6 d-flex flex-column min-height-100 mt-2 mt-md-0">
              <div className="d-flex justify-content-end mt-auto gap-2">
                <Button type="button" onClick={() => setShowDialog(true)} className="common-btn-css approve-button" disabled={!isValid || isGenerated || loader || generateLoading}>
                  Generate Forward Number
                </Button>
                <Button type="submit" className="common-btn-css submit-button" disabled={!isGenerated || loader}>
                  Forward
                </Button>
              </div>
            </div>
          </div>
        </form>

        {showDialog && (
          <Dialog title="Letter Confirmation Message" onClose={() => setShowDialog(false)} className="custom-dialog-width">
            <p>You will not be able to modify the entered data after generating the Forwarding number</p>
            <DialogActionsBar>
              <div className="d-flex justify-content-end gap-2">
                <Button onClick={() => setShowDialog(false)} className="common-btn-css cancel-button">
                  Cancel
                </Button>

                <Button onClick={handleGenerate} className="common-btn-css submit-button" disabled={generateLoading || loader}>
                  {generateLoading ? "Generating..." : "Generate"}
                </Button>
              </div>
            </DialogActionsBar>
          </Dialog>
        )}

        {/* File Number Dialog */}
        {isFileNumberDialogOpen && (
          <FileNumberDialog
            open={isFileNumberDialogOpen}
            fileNumbers={fileNumbers}
            onClose={() => setIsFileNumberDialogOpen(false)}
            selectedFileNumber={selectedFileNumber}
            onSelectFileNumber={(fileNumber) => {
              setSelectedFileNumber(fileNumber);
              setValue("fileNumber", fileNumber, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            isLoading={fileNumbersLoading}
            paginationTotal={fileNumbersPagination.total}
            onFetch={fetchFileNumbersPage}
          />
        )}

        {/* Grid  */}
        <div className="row mt-3 g-1">
          <div className="col-md-6">
            <div className="forward-table-container bg-white">
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
                <GridColumn width="70px" title="Action" cells={{ data: fileActionCell }} />
              </Grid>
            </div>
          </div>
          <div className="col-md-6">
            <div className="forward-table-container bg-white">
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
                <GridColumn field="forwarded_uid" title="Forwarded UID" />
                <GridColumn field="recipient" title="Recipient" />
                <GridColumn field="selected_region" title="Dept/RO/TE" />
                <GridColumn field="status" title="Status" />
              </Grid>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForwardDigidak;
