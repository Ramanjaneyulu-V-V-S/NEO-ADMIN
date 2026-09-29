import { useState, useMemo } from "react";

//styled component
import * as S from "./sidebar.styles";

//router dom
import { useLocation, useNavigate } from "react-router-dom";

//react icons
import { RiDraftLine } from "react-icons/ri";
import { FiSearch, FiHome } from "react-icons/fi";
import { BsFillSendFill, BsEnvelopeCheck } from "react-icons/bs";
import { SlEnvolopeLetter } from "react-icons/sl";
import { LuView, LuHardDriveUpload, LuHardDriveDownload } from "react-icons/lu";
import { FaChevronRight, FaChevronDown, FaRegEdit, FaRegPaperPlane } from "react-icons/fa";
import { MdForwardToInbox, MdOutlineCases, MdOutlineMarkEmailRead, MdClose, MdHistory, MdMarkEmailRead } from "react-icons/md";

//logo
import logo from "../../assets/logo.svg";
import CustomTooltip from "../customTooltip/CustomTooltip.jsx";
import { useSelector } from "react-redux";

import { useDDMContext } from "../../hooks/useDDMContext";

const menuItems = [
  {
    key: "dashboard",
    label: "Home",
    title: "Home",
    icon: <FiHome />,
    path: "/dashboard",
  },
  {
    key: "caseManagement",
    title: "CMS",
    label: "Case Management",
    icon: <MdOutlineCases />,
    submenu: [
      { label: "Inbox", path: "/inbox", icon: <MdOutlineMarkEmailRead /> },
      { label: "Create Case", path: "/create-case", icon: <FaRegEdit /> },
      { label: "View Case", path: "/cases", icon: <LuView /> },
      { label: "Sent Case", path: "/sent-case", icon: <BsFillSendFill /> },
      { label: "Search Case", path: "/search-case", icon: <FiSearch /> },
    ],
  },
  {
    key: "digidak",
    title: "Digidak",
    label: "Digidak",
    icon: <BsEnvelopeCheck />,
    submenu: [
      { label: "Inbox", path: "/digidak-inbox", icon: <MdForwardToInbox /> },
      { label: "Outbox", path: "/digidak-outbox", icon: <FaRegPaperPlane /> },
      {
        label: "Outward Entry",
        path: "/outward-entry",
        icon: <LuHardDriveUpload />,
      },
      {
        label: "Inward Entry",
        path: "/inward-entry",
        icon: <LuHardDriveDownload />,
      },
      { label: "Draft Entry", path: "/draft-entry", icon: <RiDraftLine /> },
      { label: "View Letters", path: "/view-letters", icon: <LuView /> },
    ],
  },

  {
    key: "personalLetterbox",
    label: "Personal Letterbox",
    title: "Letterbox",
    icon: <SlEnvolopeLetter />,
    path: "/digidak-letterbox",
  },

  // Old Cases - hidden temporarily
  // {
  //   key: "old-cases",
  //   title: "Old Cases",
  //   label: "Old Cases",
  //   icon: <MdHistory />,
  //   path: "/old-cases",
  // },

  // Old Letters (Digidak) - hidden temporarily
  // {
  //   key: "old-letters",
  //   title: "Old Letters",
  //   label: "Old Letters",
  //   icon: <MdMarkEmailRead />,
  //   submenu: [
  //     { label: "Inbox", path: "/old-letters-inbox", icon: <MdForwardToInbox /> },
  //     { label: "Outbox", path: "/old-letters", icon: <FaRegPaperPlane /> },
  //   ],
  // },
  {
    key: "ddm-communications",
    title: "DDM Communications",
    label: "DDM Communications",
    icon: <BsEnvelopeCheck />,
    submenu: [
      {
        label: "Inwarded By DDM",
        path: "/ddm-inward",
        icon: <LuHardDriveDownload />,
      },
      {
        label: "Outwarded By DDM",
        path: "/ddm-outward",
        icon: <LuHardDriveUpload />,
      },
    ],
  },
];

const Sidebar = ({ show, isMobile, onClose }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isDDM } = useDDMContext();

  const { isDDMCommunicationUser } = useSelector((state) => state.digidakDDM);
  const { isDMDChairman } = useSelector((state) => state.digidakInbox);

  const filteredMenuItems = useMemo(() => {
    const processedMenuItems = menuItems.map((item) => {
      if (item.key === "digidak") {
        return {
          ...item,
          submenu: item.submenu.filter((subItem) => {
            if (subItem.label === "View Letters") return isDMDChairman;
            return true;
          }),
        };
      }
      return item;
    });

    return processedMenuItems.filter((item) => {
      // Hide DDM Communications if user has no access
      if (item.key === "ddm-communications") {
        return isDDMCommunicationUser;
      }

      // Hide Case Management & Old Cases for DDM users
      if (isDDM && (item.key === "caseManagement" || item.key === "old-cases")) {
        return false;
      }

      return true;
    });
  }, [isDDMCommunicationUser, isDDM, isDMDChairman]);

  const [submenuState, setSubmenuState] = useState(() => {
    const active = {};
    filteredMenuItems?.forEach(({ key, submenu = [] }) => {
      if (submenu?.length > 0) active[key] = true;
    });
    return active;
  });

  const handleToggle = (key) => {
    setSubmenuState((prev) => ({
      ...Object.fromEntries(Object.keys(prev)?.map((k) => [k, false])),
      [key]: !prev[key],
    }));
  };

  const renderMenuItems = useMemo(
    () =>
      filteredMenuItems?.map(({ key, label, title, icon, submenu = [], path }) => {
        const isActive = pathname === path || submenu?.some((item) => item.path === pathname);

        const handleClick = () => {
          submenu?.length > 0 ? handleToggle(key) : navigate(path);
        };

        return (
          <li key={key}>
            <div onClick={handleClick} className={`menu-item menu-item-padding d-flex align-items-center ${isActive ? "active-menu" : ""}`}>
              <div className="icon-wrap d-flex align-items-center justify-content-center">
                {show === true ? <CustomTooltip tooltip={title}>{icon}</CustomTooltip> : <>{icon}</>}
              </div>
              <span className="menu-label">{label}</span>
              {submenu?.length > 0 && (submenuState[key] ? <FaChevronDown className="ms-auto arrow-icon" /> : <FaChevronRight className="ms-auto arrow-icon" />)}
            </div>

            {submenuState[key] && submenu?.length > 0 && (
              <ul className="list-unstyled ps-3">
                {submenu?.map(({ label, path, icon }) => (
                  <li
                    key={path}
                    onClick={() => navigate(path)}
                    className={`menu-item sub-menu-item-padding text-muted cursor-pointer ${pathname === path ? "active-sub-menu" : ""}`}
                  >
                    <span className="sub-menu-icon me-3">{show === true ? <CustomTooltip tooltip={label}>{icon}</CustomTooltip> : <>{icon}</>}</span>
                    <span className="sub-menu-label">{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      }),
    [submenuState, show, pathname, navigate, filteredMenuItems],
  );

  const sidebarClassName = useMemo(() => {
    if (isMobile) {
      return show ? "show" : "";
    }
    return show ? "collapsed" : "";
  }, [isMobile, show]);

  return (
    <S.SidebarContainer className={sidebarClassName}>
      <div className="logo-container text-center py-3">
        <img className="user-img" src={logo} alt="User Logo" width="80" height="80" />
        {isMobile && <MdClose className="close-button" onClick={onClose} />}
      </div>

      <div className="flex-fill overflow-auto pt-3">
        <h6 className="nav-title px-3">Navigation</h6>
        <ul className="list-unstyled px-2 py-0 m-0">{renderMenuItems}</ul>
      </div>
    </S.SidebarContainer>
  );
};

export default Sidebar;
