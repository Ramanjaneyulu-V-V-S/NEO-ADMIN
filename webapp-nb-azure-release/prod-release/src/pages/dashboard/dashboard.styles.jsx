import styled from "styled-components";

export const MainContainer = styled.div`
  height: calc(100vh - 70px);
  .welcome-banner {
    background: linear-gradient(135deg, #24447f, #3b6cb5);
    color: #fff;
    padding: 18px 20px;
    border-radius: 6px;
    margin-bottom: 10px;
    box-shadow: 0 2px 8px rgba(36, 68, 127, 0.15);
  }
  .welcome-text {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: 1fr;
    gap: 10px;
    height: calc(100% - 55px);
  }
  .grid-item {
    border-radius: 6px;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .grid-item > * {
    flex: 1;
    min-height: 0;
  }
  @media (max-width: 768px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
    }
    .grid-item1 {
      order: 1;
      height: 350px;
    }
    .grid-item3 {
      order: 2;
      height: 300px;
    }
    .grid-item2 {
      order: 3;
      height: 300px;
    }
    .grid-item4 {
      order: 4;
      height: 300px;
    }
    .ecm-chart-height {
      height: 230px;
    }
    .digidak-chart-height {
      height: 240px;
    }
  }
  @media (min-width: 780px) and (max-width: 1024px) {
    .ecm-chart-height {
      height: 240px;
    }
    .digidak-chart-height {
      height: 280px;
    }
  }
  @media (min-width: 1025px) and (max-width: 1279px) {
    .ecm-chart-height {
      height: 225px;
    }
    .digidak-chart-height {
      height: 270px;
    }
  }
  @media (min-width: 1280px) and (max-width: 1366px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 1fr;
    }
    .ecm-chart-height {
      height: 200px;
    }
    .digidak-chart-height {
      height: 240px;
    }
  }
  @media (min-width: 1367px) and (max-width: 1440px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 1fr;
    }
    .ecm-chart-height {
      height: 265px;
    }
    .digidak-chart-height {
      height: 300px;
    }
  }
  @media (min-width: 1441px) and (max-width: 1690px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 1fr;
    }
  }
  @media (min-width: 1441px) and (max-width: 1680px) {
    .ecm-chart-height {
      height: 280px;
    }
    .digidak-chart-height {
      height: 320px;
    }
  }
  @media (min-width: 1679px) and (max-width: 1690px) {
    .ecm-chart-height {
      height: 350px;
    }
    .digidak-chart-height {
      height: 390px;
    }
  }
  @media (min-width: 1691px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 1fr;
    }
    .ecm-chart-height {
      height: 330px;
    }
    .digidak-chart-height {
      height: 370px;
    }
  }
  @media (min-width: 1791px) {
    .ecm-chart-height {
      height: 360px;
    }
    .digidak-chart-height {
      height: 400px;
    }
  }
  .profile-info-container {
    width: 100%;
    height: 220px; /* adjust as needed */
    border-radius: 12px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;

    position: relative; /* important for overlay positioning */
    overflow: hidden;
  }
  .dashboard-text-overlay {
    top: 10px;
    left: 12px;
    z-index: 2;
    color: #fff;
    position: absolute;
  }
  .dashboard-text-overlay {
    padding: 8px 10px;
    border-radius: 10px;
    backdrop-filter: blur(3px);
    background: #00000059;
  }
  .case-info-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 10px 15px;
    background-color: #fff;
    border-radius: 2px;
    box-shadow: 0 0 0.875rem 0 rgba(33, 37, 41, 0.05);
  }
  .priority-body-container {
    gap: 6px;
    display: flex;
    overflow-y: auto;
    border-radius: 2px;
    flex-direction: column;
    flex: 1;
    align-content: flex-start;
  }
  .body-text {
    font-size: 1.1rem;
    margin-bottom: 5px;
    color: rgb(255, 255, 255);
  }
  .body-text-para {
    font-size: 13px;
    color: rgb(227 227 227);
  }
  .priority-heading {
    margin: 0;
    padding: 4px 0;
    color: #333;
    font-size: 13px;
    font-weight: 700;
  }
  .priority-dropdown {
    width: 90px;
    height: 22px;
    font-size: 13px;
  }
  .pending-case-dropdown {
    width: 100px;
    height: 22px;
    font-size: 13px;
  }
  .priority-body-text {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 2px;
    background: #ffffff;
    justify-content: space-between;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .priority-body-text:hover {
    background: #a5c3eeff;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }
  .priority-body-title {
    font-size: 11px;
    font-weight: 600;
    text-align: left;
  }
  .case-div-hover:hover {
    color: rgb(53 143 252);
  }
  .priority-case-no {
    font-weight: 600;
  }
  .priority-body-span {
    font-size: 11px;
    font-weight: 400;
  }
  .digidak-category-badge {
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 500;
    color: #24447f;
    background-color: #e8eef6;
    white-space: nowrap;
    min-width: 80px;
    text-align: center;
  }
`;
