//styled-components
import * as S from "./profilePopup.styles";

//images
import Profile from "../../assets/profile.jpg";

//react-icons
import { RiLockPasswordLine } from "react-icons/ri";
import { FaRegCircleUser } from "react-icons/fa6";
import { MdLogout, MdNotifications } from "react-icons/md";

//redux
import { useSelector } from "react-redux";
import { clearAuthSession } from "../../services/sessionCleanup";

//hooks
import { useCheckCGMSecretary } from "../../hooks/useCheckCGMSecretary";

const menus = [
  {
    id: 1,
    icon: <FaRegCircleUser />,
    name: "View Profile",
    action: "profile",
  },
  {
    id: 2,
    icon: <MdNotifications />,
    name: "Notification Settings",
    action: "notificationSettings",
  },
  {
    id: 3,
    icon: <RiLockPasswordLine />,
    name: "Change Password",
    action: "changePassword",
  },
  {
    id: 4,
    icon: <MdLogout />,
    name: " Sign out",
    action: "logout",
  },
];

const ProfilePopup = ({ handleMenuClick }) => {
  const { userProfile, isCGMSecretary } = useSelector((state) => state.login);

  // Lazily check CGM Secretary status — runs once on first popup mount (guarded inside the hook)
  useCheckCGMSecretary();

  const handleChangePassword = async () => {
    const { default: Swal } = await import("sweetalert2");
    Swal.fire({
      title: "Change Password",
      html: `For security reasons, you’ll need to log in again after changing your password. Do you wish to process?`,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "No",
      confirmButtonText: "Yes",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
      preConfirm: () => {
        clearAuthSession();

        const url = import.meta.env.VITE_FORGOT_PASSWORD_URL;
        if (url && (url.startsWith("/") || url.startsWith(window.location.origin))) {
          window.location.href = url;
        }
      },
    });
  };
  return (
    <S.PopupContainer>
      <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom">
        <S.Avatar src={Profile} alt="user profile" />
        <div className="d-flex flex-column">
          <S.UserName>{userProfile?.properties?.object_name}</S.UserName>
          <S.UserEmail>Employee Id: {userProfile?.properties?.uin}</S.UserEmail>
        </div>
      </div>

      {menus?.map((item) => (
        <S.MenuItem key={item.id} onClick={item?.action === "changePassword" ? () => handleChangePassword() : () => handleMenuClick(item.action)}>
          {item.icon}
          {item.name}
        </S.MenuItem>
      ))}
    </S.PopupContainer>
  );
};

export default ProfilePopup;
