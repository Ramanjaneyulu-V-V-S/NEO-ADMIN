import styled from "styled-components";

export const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  position: relative;
  overflow: hidden;

  .app-bar-background {
    top: 0;
    left: 50%;
    z-index: -1;
    width: 100%;
    height: 65vh;
    position: absolute;
    transform: translateX(-50%);
    background-color: #24447f;
    border-radius: 0 0 50% 50% / 0 0 5vh 5vh;
  }
  .main-content {
    flex: 1;
    z-index: 1;
    height: 100vh;
    padding: 0 1rem;
    overflow-y: auto;
    position: relative;
    transition: margin-left 0.3s ease;
  }
  .main-content.mobile {
    margin-left: 0;
  }
  .main-content.collapsed {
    margin-left: 80px;
  }
  .main-content.expanded {
    margin-left: 240px;
  }
  .footer-container {
    font-size: 13px;
    margin-top: 15px;
    position: relative;
    z-index: 2;
  }
  .footer-container a {
    font-size: 13px;
    color: #41a0f8;
  }
`;
