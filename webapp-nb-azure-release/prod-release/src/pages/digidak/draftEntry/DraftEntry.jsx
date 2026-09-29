// React
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

//components
import Layout from "../../../components/layout/Layout";
import { DropdownFilterCell } from "../../../components/dropDownFilterCell/DropdownFilterCell";

//kendo react
import { Grid, GridColumn } from "@progress/kendo-react-grid";
import { ExcelExport } from "@progress/kendo-react-excel-export";
import { HeaderTdElement } from "@progress/kendo-react-data-tools";

//import default dropdown data
import { typeData, natureCorrespondenceData, categoryData } from "../../data/DropdownData";

// Slice
import { fetchDigidakDraft, DEFAULT_PAGE_SIZE, resetDigidakDraftPagination } from "../../../redux/digidak/draft/digidakDraftSlice";
import Skeleton from "../../../components/Loader/Skeleton";
import DigidakExportButton from "../../../components/digidak/DigidakExportButton";
import useServerSideGrid from "../../../hooks/useServerSideGrid";

const FILTER_FIELD_MAP = {
  digidak_uid: "input_uid_number__",
  subject: "input_letter_subject",
  to: "input_region",
  entry_type: "input_entry_type",
  nature_of_correspondence: "input_nature_of_correspon",
  category: "input_type_category",
  decision: "input_decision_",
  responded_uid: "input_responding_uid",
};

// Text fields get debounced; dropdown fields fire immediately
const TEXT_FILTER_FIELDS = new Set(["digidak_uid", "subject", "to", "decision", "responded_uid"]);

const DraftEntry = () => {
  const excelExportRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { userProfile } = useSelector((state) => state.login);
  const userName = userProfile?.properties?.object_name;

  const { draftList, loading, pagination } = useSelector((state) => state.digidakDraft);

  const mappedDraftData = useMemo(() => {
    return (
      draftList?.map((item) => {
        const props = item?.content?.properties ?? {};

        return {
          // Grid-visible fields?
          digidak_uid: props?.uid_number || "",
          group_uid: props?.group_uid || "",
          subject: props?.letter_subject || "",
          to: props.region || "", // to
          entry_type: props?.entry_type || "",
          nature_of_correspondence: props?.nature_of_correspondence || "",
          category: props?.type_category || "",
          responded_uid: props?.responded_uid || "-",
          decision: props?.decision || "",
          selected_region: props?.selected_region || "",
          props: props,

          // Extra props
          date: props?.entry_date ? new Date(props?.entry_date).toLocaleDateString("en-IN") : "",
          due_date: props?.due_date ? new Date(props?.due_date).toLocaleDateString("en-IN") : "",
          inward_ref_date: props?.inward_ref_number || "",
          from: props?.received_from || "",
          status: props?.status || "",
          language: props?.languages || "",
          src_vertical: props?.vertical_head || "",
          assign_to: Array.isArray(props?.vertical_users) ? props?.vertical_users[0] || "" : "",
          secrecy: props?.secrecy || "",
          endorsed_to: props?.endorsed_to || "",

          // Extra fields for Copy/New Entry
          stateOfSender: props?.state_of_sender || "",
          modeOfReceipt: props?.mode_of_receipt || "",
          receivedFrom: props?.received_from || "",
          priority: props?.priority || "",
          referenceNumber: props?.inward_ref_number || "",
          senderAddress: props?.address_of_sender || "",
          mode_of_receipt: props?.mode_of_receipt,
          source_vertical: props?.source_vertical,
          is_bulk_letter: props?.is_bulk_letter,
          file_number: props?.file_number,
          address_of_sender: props?.address_of_sender,
          state_of_sender: props?.state_of_sender,
          responding_uid: props?.responding_uid,
          selectedHOROTE: props?.region?.split("-")[0] || "",
          id: props?.id,
          uid_number: props?.uid_number,
          r_folder_path: props?.r_folder_path,

          // Inward Vertical
          inward_vertical: props.inward_vertical || "",

          // Office Type and Recipient Selector
          draft_office_type: props?.draft_office_type || [],
          draft_selected_recipients: props?.draft_selected_recipients || [],
          i_folder_id: props?.i_folder_id || [],
          is_endorsed: props?.is_endorsed,
          endorse_uid: props?.endorse_uid || "",
          is_endorsed_letter: props?.is_endorsed_letter,
          is_external_excel: props?.is_external_excel,

          ddm_vertical: props?.ddm_vertical || "",
          is_ddm: props?.is_ddm,
        };
      }) ?? []
    );
  }, [draftList]);

  const uniqueData = useMemo(
    () =>
      Array.from(
        new Map(
          mappedDraftData
            ?.filter((item) => !item?.props?.is_endorsed_letter)
            ?.map((item) => {
              const key = item.group_uid || item.digidak_uid;
              return [key, item];
            }),
        ).values(),
      ),
    [mappedDraftData],
  );

  const onFetch = useCallback(
    (page, activeFilters) => {
      if (userName) {
        dispatch(fetchDigidakDraft({ userName, inputStatus: "Saved", page, ...(activeFilters || {}) }));
      }
    },
    [dispatch, userName],
  );

  const onResetPagination = useCallback(() => dispatch(resetDigidakDraftPagination()), [dispatch]);

  const { dataState, handleDataStateChange, processedData } = useServerSideGrid({
    filterFieldMap: FILTER_FIELD_MAP,
    textFilterFields: TEXT_FILTER_FIELDS,
    pageSize: DEFAULT_PAGE_SIZE,
    onFetch,
    onResetPagination,
    data: uniqueData,
    paginationTotal: pagination.total,
    initialSort: [{ field: "id", dir: "desc" }],
  });

  useEffect(() => {
    if (!userName) return;
    dispatch(resetDigidakDraftPagination());
    dispatch(fetchDigidakDraft({ userName, inputStatus: "Saved", page: 1 }));
  }, [dispatch, userName]);

  const skeletonRows = Array.from({ length: DEFAULT_PAGE_SIZE }).map((_, index) => ({ id: index }));

  // Navigate to view Digidak entry
  const handleViewDigidak = useCallback(
    (item, sourceType = "DIGIDAK_UID") => {
      let data = item?.dataItem;

      const commonMeta = {
        fromProps: "draft-screen",
        navigationSource: sourceType,
      };

      let inwardStateProp = {
        ...commonMeta,
        id: data?.id,
        uid_number: data?.uid_number,
        r_folder_path: data?.r_folder_path,
        receivedFrom: data?.receivedFrom,
        senderAddress: data?.senderAddress,
        taskCategory: data?.category,
        priority: data?.priority,
        secrecy: data?.secrecy,
        language: data?.language,
        referenceNumber: data?.referenceNumber,
        subject: data?.subject,
        stateOfSender: data?.stateOfSender,
        date: data?.date,
        modeOfReceipt: data?.modeOfReceipt,
        documentType: null,
        uploadedFile: null,
        type: data?.entry_type,
        // Inward Vertical
        inward_vertical: data?.inward_vertical || "",
        group_id: data?.group_uid,
        is_ddm: data?.is_ddm,
      };

      let outwardStateProp = {
        ...commonMeta,
        id: data?.id,
        decision: data?.decision,
        group_uid: data?.group_uid,
        r_folder_path: data?.r_folder_path,
        entry_type: data?.entry_type || "",
        natureOfCorrespondence: data?.nature_of_correspondence || "", //
        modeOfReceipt: data?.mode_of_receipt || "", //
        subject: data?.subject || "",
        category: data?.category || "",
        priority: data?.priority || "",
        secrecy: data?.secrecy || "",
        uid_number: data?.uid_number,
        language: data?.language || "",
        src_vertical: data?.source_vertical || "",
        sending_bulk_letter: data?.is_bulk_letter === "true" ? true : false,
        fileNumber: data?.file_number,
        responding_uid: data?.responding_uid || "",
        selected_region: data?.selected_region || "",
        due_date: data?.due_date,
        department: "", //
        departments: [], //
        ros: [], //
        receivedFrom: data?.receivedFrom || "",
        addressOfSender: data?.address_of_sender || "",
        stateOfSender: data?.state_of_sender || "",
        selectedHOROTE: data?.selectedHOROTE,
        external_file: null, //

        // Office Type and Recipient Selector
        draft_office_type: data?.draft_office_type,
        draft_selected_recipients: data?.draft_selected_recipients,
        i_folder_id: data?.i_folder_id,
        is_endorsed: data?.is_endorsed,
        endorse_uid: data?.endorse_uid || "",
        is_external_excel: data?.is_external_excel,
        ddm_vertical: data?.ddm_vertical,
        is_ddm: data?.is_ddm,
      };

      if (data?.id) {
        const decision = data?.decision;
        if (decision == "Inward") {
          navigate(`/inward-entry`, {
            state: { copiedData: inwardStateProp },
          });
        } else if (decision == "Outward") {
          navigate(`/outward-entry`, {
            state: { copiedData: outwardStateProp },
          });
        }
      }
    },
    [navigate],
  );

  const DigidakUIDCell = (props) => {
    const isGroupUIDTrue = Boolean(props.dataItem.group_uid);

    return (
      <td>
        <span
          className="fw-bold color-blue cursor-pointer"
          onClick={isGroupUIDTrue ? () => handleViewDigidak(props, "GROUP_UID") : () => handleViewDigidak(props, "DIGIDAK_UID")}
        >
          {isGroupUIDTrue ? props.dataItem.group_uid : props.dataItem.digidak_uid}
        </span>
      </td>
    );
  };

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-between my-2">
        <h6 className="case-title-h6">Draft Digidak</h6>
        <DigidakExportButton excelExportRef={excelExportRef} data={processedData?.data} className="export-to-excel" />
      </div>

      <div className="inbox-sent-draft-grid">
        <ExcelExport data={processedData} fileName="Draft_Entry_List.xlsx" ref={excelExportRef}>
          <Grid
            {...dataState}
            data={loading ? { data: skeletonRows, total: processedData.total } : processedData}
            sortable={true}
            resizable={true}
            filterable={true}
            pageable={{
              info: true,
              buttonCount: 10,
              pageSizes: false,
            }}
            onDataStateChange={handleDataStateChange}
          >
            <GridColumn field="digidak_uid" title="Digidak UID" cells={{ data: loading ? Skeleton : DigidakUIDCell }} />
            <GridColumn field="decision" title="In/Out" cells={{ data: loading ? Skeleton : undefined }} />
            <GridColumn field="subject" title="Subject" cells={{ data: loading ? Skeleton : undefined }} />
            <GridColumn field="to" title="Sent To" cells={{ data: loading ? Skeleton : undefined }} />
            <GridColumn
              field="entry_type"
              title="Type"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={typeData.map((item) => item.text)} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : undefined,
              }}
            />
            <GridColumn
              field="nature_of_correspondence"
              title="Nature of Correspondence"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={natureCorrespondenceData.map((item) => item.text)} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : undefined,
              }}
            />
            <GridColumn
              field="category"
              title="Category"
              cells={{
                filterCell: (props) => (
                  <HeaderTdElement columnId={props.thProps?.columnId || ""} {...props.thProps}>
                    <DropdownFilterCell {...props} data={categoryData.map((item) => item.text)} />
                  </HeaderTdElement>
                ),
                data: loading ? Skeleton : undefined,
              }}
            />
            <GridColumn field="responded_uid" title="Responded UID" cells={{ data: loading ? Skeleton : undefined }} />
          </Grid>
        </ExcelExport>
      </div>
    </Layout>
  );
};

export default DraftEntry;
