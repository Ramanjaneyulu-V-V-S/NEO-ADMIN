import { useState, useEffect } from "react";
import * as S from "./layout.styles";
import Header from "../header/Header";
import Sidebar from "../sidebar/Sidebar";
import useLayoutDataFetch from "../../hooks/useLayoutDataFetch";

const Layout = ({
  children,
  fbdPopup,
  screenName,
  movementPop,
  caseInfoPop,
  acquirePopup,
  showUploadPop,
  workflowPopup,
  approveSendPop,
  referencePop,
  notesheetPreview,
  approvePop,
  caseClosurePop,
  caseCancelPop,
  allCircularsPop,
}) => {
  useLayoutDataFetch(screenName);

  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [windowSize, setWindowSize] = useState();

  const popupsList =
    fbdPopup ||
    movementPop ||
    acquirePopup ||
    caseInfoPop ||
    showUploadPop ||
    workflowPopup ||
    approveSendPop ||
    referencePop ||
    notesheetPreview ||
    caseClosurePop ||
    approvePop ||
    caseCancelPop ||
    allCircularsPop;

  const isPopupOpen = windowSize < 1024 && popupsList;

  const handleMenuClick = () => setShow((prev) => !prev);
  const handleClose = () => setShow(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize(window.innerWidth);
      setIsMobile(popupsList ? false : window.innerWidth < 1024);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [popupsList]);

  useEffect(() => {
    if (popupsList) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [popupsList]);

  useEffect(() => {
    if (isMobile && windowSize < 1024) {
      setShow(false);
    }
  }, [windowSize, isMobile]);

  return (
    <S.LayoutContainer>
      <Sidebar show={show} isMobile={isMobile} onClose={handleClose} />

      <main className={`main-content ${isPopupOpen ? "mobile" : isMobile ? "mobile" : show ? "collapsed" : "expanded"}`}>
        <div className="app-bar-background" />
        <Header onMenuClick={handleMenuClick} />
        {children}
      </main>
    </S.LayoutContainer>
  );
};

export default Layout;
