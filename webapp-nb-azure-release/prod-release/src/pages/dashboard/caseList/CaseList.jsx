import React, { useState, useMemo, useCallback, useEffect } from "react";

//kendo component
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Pager } from "@progress/kendo-react-data-tools";

//utils
import { formatDateCell, getPriorityClass } from "../../../utils/Utils";

// Router
import { useNavigate } from "react-router-dom";

// Tooltip
import { Tooltip as BootstrapTooltip } from "bootstrap";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchInboxCases } from "../../../redux/caseManagement/caseInbox/caseInboxSlice";

const priorityOptions = ["All", "Ordinary", "Urgent"];
const PAGE_SIZE = 50;

const CaseList = ({ loading, isDMDChairmanConditionMatch, pendingCases = [] }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedPriority, setSelectedPriority] = useState("All");
  const { pagination } = useSelector((state) => state?.caseInbox);
  const currentPage = pagination?.page || 1;

  const payload = isDMDChairmanConditionMatch ? ["FYA", "To be Verified DMDS1", "To be Verified DMDS2", "To be Verified Chairman"] : "FYA";

  const filteredCases = useMemo(() => {
    const priorityOrder = { Urgent: 1, Ordinary: 2 };

    if (selectedPriority === "All") {
      return [...pendingCases].sort((a, b) => {
        const aPriority = priorityOrder[a.content.properties.packagescase_foldertask_priority] || 99;
        const bPriority = priorityOrder[b.content.properties.packagescase_foldertask_priority] || 99;
        return aPriority - bPriority;
      });
    }

    // Urgent or Ordinary → just filter
    return pendingCases.filter((item) => item.content.properties.packagescase_foldertask_priority === selectedPriority);
  }, [selectedPriority, pendingCases]);

  const handleRedirect = useCallback(
    (caseItem) => {
      const props = caseItem?.content?.properties ?? {};
      const links = caseItem?.content?.links ?? [];
      const selfLink = links.find((link) => link.rel === "self")?.href;

      if (props?.packagescase_folderid) {
        navigate(`/view-case/${props.packagescase_folderid}`, {
          state: {
            path: "dashboard",
            screenName: "inboxScreen",
            itemId: props?.id,
            workflowLinks: selfLink,
            isInitiateWorkflow: true,
            acquireStatus: props?.task_state,
            folderId: props?.packagescase_folderid,
            caseStatus: props?.packagescase_folderstatus,
            rModifier: props?.packagescase_folderr_modifier,
            autoNumOutput: props?.packagescase_folderobject_name,
            rCreatorName: props?.packagescase_folderr_creator_name,
            param_department: props?.packagesworkflow_paramdepartment,
          },
        });
      }
    },
    [navigate],
  );

  const handlePageChange = (e) => {
    const newPage = Math.floor(e.skip / PAGE_SIZE) + 1;
    dispatch(fetchInboxCases({ input_task_name: payload, page: newPage, "items-per-page": PAGE_SIZE }));
  };

  useEffect(() => {
    // Re-init on every list change. Dispose any prior instance attached to the
    // same node (filter/data refresh re-renders) so we don't leak floating
    // tooltip <div>s in <body> after their trigger is unmounted.
    // Scoped selector — DigidakList uses its own `.digidak-list-tooltip` class.
    // Without scoping, a re-render here would dispose the other list's tooltip
    // instances and cause cross-component closest()-on-null crashes.
    const triggers = document.querySelectorAll('.case-list-tooltip[data-bs-toggle="tooltip"]');
    const instances = [...triggers].map((el) => {
      BootstrapTooltip.getInstance(el)?.dispose();
      return new BootstrapTooltip(el);
    });
    return () => {
      instances.forEach((t) => {
        // Swallow errors: by the time cleanup runs, React may have already
        // unmounted the trigger node, so Bootstrap's internal `.closest()` call
        // throws "Cannot read properties of null". We're disposing anyway.
        try { t.hide(); } catch { /* noop */ }
        try { t.dispose(); } catch { /* noop */ }
      });
    };
  }, [filteredCases]);

  return (
    <>
      {loading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="case-info-container">
        <div className="priority-body-text mb-2">
          <h4 className="priority-heading">Pending Cases with Me : {pagination?.total || filteredCases?.length}</h4>
          <DropDownList
            data={priorityOptions}
            value={selectedPriority}
            className="pending-case-dropdown"
            onChange={(e) => setSelectedPriority(e.value)}
            aria-label="Filter by priority"
          />
        </div>
        <div className="priority-body-container">
          {filteredCases?.map((caseItem) => {
            const {
              id,
              packagescase_folderobject_name,
              packagescase_folderdescription,
              packagesworkflow_paramtask_name,
              packagesworkflow_paramtask_received,
              packagescase_folderr_modifier,
              packagescase_foldertask_priority,
            } = caseItem.content.properties;
            const updatedTaskStatus = packagesworkflow_paramtask_name === "FYA" ? "For Your Action" : "To be Verified";

            return (
              <button key={id} className="priority-body-text cursor-pointer border-0" onClick={() => handleRedirect(caseItem)}>
                <div className="priority-body-title">
                  Case: {packagescase_folderobject_name}
                  <br />
                  <span className="priority-body-span case-list-tooltip" data-bs-toggle="tooltip" data-bs-placement="top" title={packagescase_folderdescription}>
                    Subject: {packagescase_folderdescription?.substring(0, 50)}
                    {packagescase_folderdescription?.length > 50 && "..."}
                  </span>
                  <br />
                  <span className="priority-body-span mt-2">
                    Initiated on: {packagesworkflow_paramtask_received ? formatDateCell(packagesworkflow_paramtask_received) : "[Date not provided]"} by{" "}
                    {packagescase_folderr_modifier}
                  </span>
                  {isDMDChairmanConditionMatch && (
                    <>
                      <br />
                      <span className="priority-body-span">Task Status: {updatedTaskStatus}</span>
                    </>
                  )}
                </div>
                <div className={`priority-btn ${getPriorityClass(packagescase_foldertask_priority)}`}>{packagescase_foldertask_priority}</div>
              </button>
            );
          })}
        </div>
        <Pager
          skip={(currentPage - 1) * PAGE_SIZE}
          take={PAGE_SIZE}
          total={pagination?.total || 0}
          onPageChange={handlePageChange}
          buttonCount={5}
          info={true}
          previousNext={true}
        />
      </div>
    </>
  );
};

export default CaseList;
