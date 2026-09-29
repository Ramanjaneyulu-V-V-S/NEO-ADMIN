import { useEffect } from "react";

// Styled Components
import * as S from "./dashboard.styles";

// Components
import CaseList from "./caseList/CaseList";
import Layout from "../../components/layout/Layout";

// Redux
import { useDispatch, useSelector } from "react-redux";
import DigidakList from "./digidakList/DigidakList";
import { fetchButtonCondition } from "../../redux/login/loginSlice";
import { fetchDigidakInboxV2 } from "../../redux/digidak/inbox/digidakInboxSlice";
import { fetchInboxCases } from "../../redux/caseManagement/caseInbox/caseInboxSlice";
import { fetchDashboardVerticals } from "../../redux/dashboard/dashboardSlice";

const DashboardNew = () => {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state?.login);
  const { object_name, office_type } = userProfile?.properties || {};
  const { inboxCases, loading } = useSelector((state) => state?.caseInbox);
  const { inboxList, groups } = useSelector((state) => state.digidakInbox);
  const { isDMDChairman: isDMDChairmanConditionMatch } = useSelector((state) => state.digidakInbox);

  useEffect(() => {
    if (isDMDChairmanConditionMatch) {
      dispatch(fetchInboxCases({ input_task_name: ["FYA", "To be Verified DMDS1", "To be Verified DMDS2", "To be Verified Chairman"], page: 1, "items-per-page": 50 }));
    } else {
      dispatch(fetchInboxCases({ input_task_name: "FYA", page: 1, "items-per-page": 50 }));
    }
  }, [dispatch, isDMDChairmanConditionMatch]);

  useEffect(() => {
    const userGroups = groups?.variables?.out_groups_user || [];
    dispatch(fetchDigidakInboxV2({ userName: object_name, groups: userGroups, page: 1 }));
  }, [groups, dispatch, object_name]);

  useEffect(() => {
    dispatch(
      fetchButtonCondition({
        "run-stateless": "true",
        data: {
          variables: {
            for_dmd_chairman_condition: true,
            in_login_user: userProfile?.properties?.object_name,
          },
        },
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Non-Chairman HO users only: fetch dashboard verticals based on user profile.
  // Restored from the original ECM/Digidak chart implementation; even though the
  // charts are gone, downstream screens (View Profile, Cases, Old Cases) read
  // dashboardVerticals from this slice. RO/TE users skip this API.
  useEffect(() => {
    if (isDMDChairmanConditionMatch) return;
    if (office_type !== "HO" || !object_name) return;
    dispatch(
      fetchDashboardVerticals({
        "run-stateless": "true",
        office_type,
        data: {
          variables: {
            inp_object_name: object_name,
            inp_office_type: "HO",
            inp_folder_path: "",
          },
        },
      }),
    );
  }, [isDMDChairmanConditionMatch, dispatch, object_name, office_type]);

  return (
    <Layout>
      <S.MainContainer>
        <div className="welcome-banner">
          <h4 className="welcome-text">Welcome, {object_name}</h4>
        </div>
        <div className="dashboard-grid">
          <div className="grid-item grid-item3">
            <CaseList loading={loading} isDMDChairmanConditionMatch={isDMDChairmanConditionMatch} pendingCases={inboxCases} />
          </div>
          <div className="grid-item grid-item4">
            <DigidakList loading={loading} inboxList={inboxList} />
          </div>
        </div>
      </S.MainContainer>
    </Layout>
  );
};

export default DashboardNew;
