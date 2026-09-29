//styled-components
import * as S from "./viewProfile.styles";

//kendo component
import { Dialog } from "@progress/kendo-react-dialogs";

//images
import Profile from "../../assets/profile.jpg";

//redux
import { useSelector } from "react-redux";

const ViewProfile = ({ visible, onClose }) => {
  const { userProfile, isCGMSecretary } = useSelector((state) => state?.login);
  const { dashboardVerticals } = useSelector((state) => state?.dashboard);

  const { designation, office_type, department_name, location, department_short_code_multi, user_role, user_email_address, uin, object_name, user_grade } =
    userProfile?.properties || {};

  const displayCodes = dashboardVerticals?.filter((c) => !Array.isArray(c.value)).map((c) => c.text);

  const GROUP_A = ["AM", "MGR", "AGM", "DGM", "GM", "CGM"];
  const GROUP_B = ["DA", "SDA", "SSDA"];

  const userDesignation = designation?.trim().toUpperCase();
  const userGroup = GROUP_A.includes(userDesignation) ? "A" : GROUP_B.includes(userDesignation) ? "B" : "";

  return (
    visible && (
      <Dialog title="My Profile" onClose={onClose} className="menu-profile-popup">
        <div className="d-flex align-items-center gap-2 px-3 py-2 ">
          <S.Avatar src={Profile} alt="user profile" />
          <div className="d-flex flex-column">
            <S.UserName>
              {object_name} ({uin})
            </S.UserName>
            <S.UserEmail>{user_email_address}</S.UserEmail>
          </div>
        </div>

        <div className="p-3">
          {userGroup && (
            <div className="d-flex align-items-start">
              <strong className="width-150">Group</strong> <p>: {userGroup}</p>
            </div>
          )}

          <div className="d-flex align-items-start">
            <strong className="width-150">Grade</strong>{" "}
            <p>
              :{" "}
              {user_grade
                ?.split("_")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
            </p>
          </div>

          <div className="d-flex align-items-start">
            <strong className="width-150">Designation</strong> <p>: {designation}</p>
          </div>

          <div className="d-flex align-items-start">
            <strong className="width-150">Office Type</strong> <p>: {office_type}</p>
          </div>

          {office_type === "HO" && (
            <>
              <div className="d-flex align-items-start">
                <strong className="width-150">Department</strong> <p>: {department_name}</p>
              </div>

              <div className="d-flex align-items-start">
                <strong className="width-150">Vertical(s)</strong>
                <p>
                  {displayCodes?.map((item) => (
                    <div key={item}>: {item}</div>
                  ))}
                </p>
              </div>
            </>
          )}

          {office_type !== "HO" && (
            <>
              <div className="d-flex align-items-start">
                <strong className="width-150">Location</strong> <p>: {location}</p>
              </div>

              <div className="d-flex align-items-start">
                <strong className="width-150">Department(s)</strong>
                <p>
                  {department_short_code_multi?.map((item) => (
                    <div key={item}>: {item?.toUpperCase()}</div>
                  ))}
                </p>
              </div>
            </>
          )}

          {user_role && (
            <div className="d-flex align-items-start">
              <strong className="width-150">Role</strong> <p>: {user_role}</p>
            </div>
          )}

          <div className="d-flex align-items-start">
            <strong className="width-150">CGM Secretary</strong> <p>: {isCGMSecretary === true ? "Yes" : "No"}</p>
          </div>
        </div>
      </Dialog>
    )
  );
};

export default ViewProfile;
