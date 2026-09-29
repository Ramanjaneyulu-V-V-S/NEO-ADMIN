import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropDownList } from "@progress/kendo-react-dropdowns";
import { Pager } from "@progress/kendo-react-data-tools";
import { Tooltip as BootstrapTooltip } from "bootstrap";
import { formatDateCell } from "../../../utils/Utils";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchDigidakInboxV2 } from "../../../redux/digidak/inbox/digidakInboxSlice";

const typeFilterOptions = [
  { text: "All", value: "All" },
  { text: "Actionable", value: "Actionable" },
  { text: "Information", value: "Information" },
];

const PAGE_SIZE = 50;

const DigidakList = ({ loading, inboxList = [] }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(typeFilterOptions[0]);

  const { pagination, groups } = useSelector((state) => state.digidakInbox);
  const { userProfile } = useSelector((state) => state?.login);
  const object_name = userProfile?.properties?.object_name;
  const userGroups = groups?.variables?.out_groups_user || [];

  const currentPage = pagination?.page || 1;

  const mappedInboxData = useMemo(() => {
    return (
      inboxList?.map((item) => {
        const props = item?.content ? (item?.content?.properties ?? {}) : (item ?? {});
        const { id, r_object_id, uid_number, status, letter_subject, type_category, completion_date, i_folder_id, decision, received_from, login_region } = props;
        return {
          id: id || r_object_id,
          i_folder_id,
          digidak_uid: uid_number || "-",
          status: status || "-",
          subject: letter_subject || "-",
          category: type_category || "-",
          decision: decision,
          received_from: received_from || "-",
          login_region: login_region || "-",
          date: completion_date || null,
        };
      }) ?? []
    );
  }, [inboxList]);

  const filteredInboxData = useMemo(() => {
    if (selectedTypeFilter?.value === "All") return mappedInboxData;
    return mappedInboxData.filter((item) => item.category === selectedTypeFilter?.value);
  }, [mappedInboxData, selectedTypeFilter]);

  const handleViewDigidak = useCallback(
    (item) => {
      if (item?.id) {
        navigate(`/digidak-view/${item.id}`, {
          state: {
            pathname: "/digidak-inbox",
            screenName: "viewInward",
            digidakObjectId: item.id,
            digidak_uid: item.digidak_uid,
            i_folder_id: item.i_folder_id,
          },
        });
      }
    },
    [navigate],
  );

  const handlePageChange = (e) => {
    const newPage = Math.floor(e.skip / PAGE_SIZE) + 1;
    dispatch(fetchDigidakInboxV2({ userName: object_name, groups: userGroups, page: newPage }));
  };

  // Bootstrap tooltips: re-init when the visible list changes; dispose on
  // cleanup so unmounted triggers don't leave orphan tooltip <div>s in <body>.
  useEffect(() => {
    const triggers = document.querySelectorAll('.digidak-list-tooltip[data-bs-toggle="tooltip"]');
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
  }, [filteredInboxData]);

  return (
    <>
      {loading && (
        <div className="k-loading-mask">
          <div className="k-loading-image"></div>
        </div>
      )}

      <div className="case-info-container">
        <div className="priority-body-text mb-2 d-flex align-items-center gap-2">
          <h4 className="priority-heading mb-0">Digidak Letters : {pagination?.total || filteredInboxData.length}</h4>
          <DropDownList
            data={typeFilterOptions}
            textField="text"
            dataItemKey="value"
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.value)}
            className="priority-dropdown"
          />
        </div>
        <div className="priority-body-container">
          {filteredInboxData.map((item) => (
            <button key={item.id} className="priority-body-text cursor-pointer border-0" onClick={() => handleViewDigidak(item)}>
              <div className="priority-body-title">
                {item.digidak_uid}
                <br />
                <span className="priority-body-span digidak-list-tooltip" data-bs-toggle="tooltip" data-bs-placement="top" title={item.subject}>
                  Subject: {item.subject?.substring(0, 50)}
                  {item.subject?.length > 50 && "..."}
                </span>
                <br />
                <span className="priority-body-span">Sender: {item?.decision === "Inward" ? item?.received_from : item?.login_region}</span>
                <br />
                <span className="priority-body-span">
                  Initiated on: {item.date ? formatDateCell(item.date) : "-"} &middot; {item.status}
                </span>
              </div>
              <div className="digidak-category-badge">{item.category}</div>
            </button>
          ))}
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

export default DigidakList;
