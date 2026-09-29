import styled from "styled-components";

export const SidebarContainer = styled.div`
  width: 240px;
  height: 100vh;
  position: fixed;
  background: #fff;
  display: flex;
  z-index: 9999;
  flex-direction: column;
  border-top-right-radius: 6px;
  box-shadow: 2px 0 4px rgba(24, 16, 16, 0.05);

  .logo-container {
    border-bottom: 1px solid #f0f0f0;
    position: relative;
    min-height: 70px;
    flex-shrink: 0;
  }
  .close-button {
    position: absolute;
    right: 10px;
    top: 20px;
    transform: translateY(-50%);
    cursor: pointer;
    font-size: 20px;
    color: #4d80b3;
  }
  .nav-title {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.025em;
    color: rgb(115, 116, 118);
  }
  .menu-wrapper {
    border-top: 1px solid #f0f0f0;
    margin-top: auto;
    flex-shrink: 0;
  }
  .menu-item {
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.025em;
  }
  .menu-item-padding {
    padding: 12px;
  }
  .sub-menu-item-padding {
    padding: 6px 6px 8px 25px;
  }
  .icon-wrap {
    font-size: 1rem;
    color: #4d80b3;
  }
  .menu-label {
    color: #1a1c1f;
    margin-left: 1rem;
  }
  .sub-menu-icon {
    font-size: 1rem;
    color: #4d80b3;
  }
  .sub-menu-label {
    color: #1a1c1f;
  }
  .menu-label:hover {
    color: #4d80b3;
  }
  .active-menu {
    border-radius: 8px;
    background-color: #d2dee9;
  }
  .active-menu > .menu-label {
    color: #003366;
  }
  .active-sub-menu > .sub-menu-label {
    color: rgb(53 143 252);
    border-bottom: 1px dashed rgb(53 143 252);
  }
  .sub-menu-label:hover {
    color: rgb(53 143 252);
    border-bottom: 1px dashed rgb(53 143 252);
  }

  @media (min-width: 768px) {
    &.collapsed {
      width: 80px;

      .user-img {
        width: 3.5rem;
        height: 3.5rem;
      }
      .nav-title,
      .menu-label,
      .sub-menu-label,
      .arrow-icon {
        display: none;
      }
      .menu-item-padding {
        justify-content: center !important;
      }
      .sub-menu-item-padding {
        padding: 6px 6px 8px 10px !important;
      }
      .icon-wrap {
        font-size: 1.1rem !important;
      }
    }
  }

  @media (max-width: 1023px) {
    transform: translateX(-100%);
    box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);

    &.show {
      transform: translateX(0);
    }
    .close-button {
      display: block;
    }
    &.collapsed {
      transform: translateX(-100%);
    }
  }
`;
