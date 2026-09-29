import styled from "styled-components";

export const HeaderContainer = styled.div`
  color: white;
  box-shadow: none;
  background-color: #24447f;
  border-bottom: 1px solid rgb(122 122 122 / 28%);

  .header-icons {
    cursor: pointer;
    font-size: 16px;
    color: #ffffff;
    transition:
      max-height 0.4s ease,
      opacity 0.3s ease;
  }
  .popup-wrapper {
    top: 50px;
    right: 40px;
    z-index: 99999999999;
  }
  .profile-popup-wrapper {
    top: 50px;
    right: 20px;
    z-index: 9999999999999;
  }
  .vertical-line {
    width: 1px;
    height: 24px;
    margin: 0 5px 0 10px;
    background-color: #ffffff47;
  }
  .header-search-input {
    width: 300px;
    border: none;
    height: 35px;
    outline: none;
    font-size: 13px;
    padding: 9px 15px;
    box-shadow: none;
    color: #c8c8c8;
    border-radius: 0.75rem 0 0 0.75rem;
    background-color: rgba(0, 0, 0, 0.2);
  }
  .icon-wrapper {
    height: 35px;
    padding: 10px 10px;
    border-radius: 0 0.75rem 0.75rem 0;
    background-color: rgba(0, 0, 0, 0.2);
  }
  .search-icon {
    cursor: pointer;
    color: #b8b8b8;
  }
  .header-icons:hover {
    color: #ffffff;
  }
  .notification-count {
    width: 16px;
    height: 16px;
    font-size: 8px;
    background: #cc0000;
    color: #ffffff;
    border-radius: 50%;
    position: absolute;
    top: -6px;
    right: -7px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 767px) {
    .vertical-line {
      display: none;
    }
    .search-area {
      display: none !important;
    }
  }
`;
