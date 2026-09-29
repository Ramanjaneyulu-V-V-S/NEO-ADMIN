import { useEffect, useMemo, useRef, useState } from "react";

//styled  components
import * as S from "./movementRegister.styles";

//kendo components
import { Dialog } from "@progress/kendo-react-dialogs";
import { useLocation } from "react-router-dom";

//react-icons
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { FiFileText, FiUpload, FiSearch, FiCheckCircle, FiBookmark, FiFolder } from "react-icons/fi";

//utils
import { formatTime, formatDateOnly, formatDateCellWithSec } from "../../../../utils/Utils";

const MovementRegister = ({ visible, movementRegisterData, onClose }) => {
  const location = useLocation();
  const pathNameUrl = location?.pathname;

  const isCMSPath =
    pathNameUrl === "/old-cases" ||
    pathNameUrl === "/cases" ||
    pathNameUrl === "/inbox" ||
    pathNameUrl === "/search-case" ||
    pathNameUrl?.startsWith("/reference-case/") ||
    pathNameUrl?.startsWith("/view-case/") ||
    pathNameUrl?.startsWith("/view-old-case/");

  const [expandedItems, setExpandedItems] = useState({});
  const initialExpansionDone = useRef(false);

  const toggleExpand = (index) => {
    setExpandedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getEventIcon = (title) => {
    const titleLower = title?.toLowerCase();

    if (titleLower?.includes("created")) {
      return <FiFileText />;
    } else if (titleLower?.includes("document") || titleLower?.includes("submitted")) {
      return <FiUpload />;
    } else if (titleLower?.includes("review")) {
      return <FiSearch />;
    } else if (titleLower?.includes("verification") || titleLower?.includes("completed")) {
      return <FiCheckCircle />;
    } else if (titleLower?.includes("approval")) {
      return <FiBookmark />;
    } else if (titleLower?.includes("closed")) {
      return <FiFolder />;
    } else {
      return <FiFileText />;
    }
  };

  const transformedEvents = useMemo(() => {
    if (!movementRegisterData?.length) return [];
    return movementRegisterData?.map((entry) => {
      const properties = entry?.content?.properties;

      return {
        decision: isCMSPath ? properties?.decision : properties?.status,
        received_date: new Date(properties?.received_date),
        completion_date: isCMSPath ? new Date(properties?.completion_date) : new Date(properties?.r_creation_date),
        performer: isCMSPath ? properties?.performer : properties?.owner_name,
        assigned_user: properties?.assigned_user,
        choosen_user: properties?.choosen_user,
        status: properties?.status || "",
        comments: isCMSPath ? properties?.task_comments || "" : properties?.comments || "",
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementRegisterData]);

  // Expand every timeline card the first time data arrives. Subsequent toggles by
  // the user are preserved — we only seed once per mount.
  useEffect(() => {
    if (initialExpansionDone.current || !transformedEvents?.length) return;
    const allExpanded = {};
    transformedEvents.forEach((_, i) => {
      allExpanded[i] = true;
    });
    setExpandedItems(allExpanded);
    initialExpansionDone.current = true;
  }, [transformedEvents]);

  return (
    visible && (
      <Dialog title="Movement Register" onClose={onClose} className="movementRegister-dialog-wh">
        <div className="movement-register-div p-2">
          <S.TimelineContainer>
            {transformedEvents?.map((event, index) => {
              const isExpanded = expandedItems[index] || false;
              const eventIcon = getEventIcon(event.title);
              const user = event?.assigned_user || event?.choosen_user;

              return (
                <S.TimelineItem key={index}>
                  <S.TimeStamp>
                    {isCMSPath ? (
                      <>
                        <S.Time> {formatTime(event.completion_date)}</S.Time>
                        <S.Period>{formatDateOnly(event.completion_date)} </S.Period>
                      </>
                    ) : (
                      <>
                        <S.Time> {formatTime(event.received_date)}</S.Time>
                        <S.Period>{formatDateOnly(event.received_date)} </S.Period>
                      </>
                    )}
                  </S.TimeStamp>
                  <S.Marker />

                  <S.Content>
                    <S.StatusCard>
                      <S.StatusHeader onClick={() => toggleExpand(index)}>
                        <div className="d-flex flex-column">
                          <S.StatusTitle>
                            <S.StatusIcon className="d-flex align-items-center justify-content-center">{eventIcon}</S.StatusIcon>
                            <S.TitleText> {event.decision === "Finished" ? "Closed" : event.decision} </S.TitleText>
                          </S.StatusTitle>
                        </div>

                        <S.ExpandIcon className="d-flex align-items-center justify-content-center">
                          {isExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                        </S.ExpandIcon>
                      </S.StatusHeader>

                      <S.DetailContainer isexpanded={isExpanded}>
                        {event.performer && (
                          <S.DetailItem>
                            <S.DetailLabel>Action Performer:</S.DetailLabel>
                            <S.DetailValue>{event.performer?.startsWith("ecm_") ? event.performer.toUpperCase() : event.performer}</S.DetailValue>
                          </S.DetailItem>
                        )}

                        {isCMSPath ? (
                          <S.DetailItem>
                            <S.DetailLabel>Assigned User:</S.DetailLabel>
                            <S.DetailValue>{user ? (user.startsWith("ecm_") ? user.toUpperCase() : user) : "-"}</S.DetailValue>
                          </S.DetailItem>
                        ) : (
                          <>
                            {event.assigned_user?.length > 0 && (
                              <S.DetailItem>
                                <S.DetailLabel>Assigned User:</S.DetailLabel>
                                <S.DetailValue>
                                  {event.assigned_user.map((user, index) => (
                                    <div key={index}>{user?.startsWith("ecm_") ? user.toUpperCase() : user}</div>
                                  ))}
                                </S.DetailValue>
                              </S.DetailItem>
                            )}
                          </>
                        )}

                        <S.DetailItem>
                          <S.DetailLabel>Completion Date:</S.DetailLabel>
                          <S.DetailValue>{formatDateCellWithSec(isCMSPath ? event.completion_date : event.received_date)}</S.DetailValue>
                        </S.DetailItem>

                        {!isCMSPath && (
                          <S.DetailItem>
                            <S.DetailLabel>Status:</S.DetailLabel>
                            <S.DetailValue>{event.status}</S.DetailValue>
                          </S.DetailItem>
                        )}

                        {isCMSPath ? (
                          <>
                            {event.decision === "Push Back" && (
                              <S.DetailItem>
                                <S.DetailLabel>Comment:</S.DetailLabel>
                                <S.DetailValue>{event.comments}</S.DetailValue>
                              </S.DetailItem>
                            )}
                          </>
                        ) : (
                          <>
                            {event.status === "Pushback" && (
                              <S.DetailItem>
                                <S.DetailLabel>Pushback Comment:</S.DetailLabel>
                                <S.DetailValue>{event.comments}</S.DetailValue>
                              </S.DetailItem>
                            )}
                          </>
                        )}
                      </S.DetailContainer>
                    </S.StatusCard>
                  </S.Content>
                </S.TimelineItem>
              );
            })}
          </S.TimelineContainer>

          {(!transformedEvents || transformedEvents?.length === 0) && (
            <div className="d-flex justify-content-center align-items-center py-3">
              <p className="text-muted mb-0">No Movement Register Found</p>
            </div>
          )}
        </div>
      </Dialog>
    )
  );
};

export default MovementRegister;
