import styled from "styled-components";

export const ViewCaseContainer = styled.div`
  .card-container {
    padding: 15px 15px;
    background-color: #ffffff;
    height: calc(100vh - 55px);
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
  }
  .case-info-buttons {
    border: none;
    font-size: 12px;
    color: #707070;
    padding: 4px 8px;
    background: #e8e8e8;
  }
  .case-info-active-btn {
    color: #0d6efd;
    background: #0d6efd33;
  }
  .case-info-label {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
  .case-info-label-span {
    color: #000000;
  }
  .case-information-label {
    font-size: 11px;
    font-weight: 500;
  }
  .edit-case-info-dropdown {
    height: 25px;
    font-size: 13px;
  }
  .back-btn-container {
    cursor: pointer;
    font-size: 11px;
    padding: 3px;
    color: #f20e33;
    border-radius: 10px;
    background: #ffa69dc4;
  }
  .note-btn-container {
    cursor: pointer;
    font-size: 11px;
    padding: 3px;
    border-radius: 10px;
    color: rgb(24 138 226);
    background-color: rgb(220 237 251);
  }
  .left-right-viewer-close {
    color: #f20e33;
    background: #ffa69dc4;
  }
  .left-right-viewer {
    color: #0d6efd;
    background: #0d6efd33;
  }
  .add-formal-comment {
    cursor: pointer;
    font-size: 13px;
    padding: 5px 12px;
    color: #fff;
    border-radius: 20px;
    background: #198754;
  }
  .hr {
    margin-top: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid #bdbebf;
  }
  .panel-container {
    margin-top: 6px;
  }
  .panel-container > ul {
    cursor: pointer;
    border-radius: 8px;
    box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.1);
  }
  .panel-container > ul > li > .k-selected {
    color: white;
    background-color: #ff6358;
    border-radius: 8px;
  }
  .panel-container > ul > li > .k-link {
    cursor: pointer;
    border-radius: 8px;
  }
  .panel-container > ul > li > div {
    border-radius: 8px;
  }
  .case-info-container {
    padding: 7px 20px;
    overflow-y: auto;
    height: auto;
    font-size: 13px;
  }
  .case-info-container-active {
    max-height: calc(100vh - 222px);
  }
  .case-info-container-in-active {
    max-height: calc(100vh - 420px);
  }
  .case-info-row {
    display: flex;
    align-items: flex-start;
    font-size: 13px;
  }
  .table-container {
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.1);
  }
  .table-container-scrollable {
    overflow-y: auto;
    max-height: calc(100vh - 420px);
  }
  .document-table {
    height: auto;
    overflow-y: auto;
  }
  .circular-table-active {
    max-height: calc(100vh - 500px);
  }
  .document-table-active {
    max-height: calc(100vh - 222px);
  }
  .document-table-in-active {
    max-height: calc(100vh - 515px);
  }
  .table-title {
    font-size: 13px;
    font-weight: 600;
    color: #000000;
  }
  .case-info-table-row {
    font-size: 13px;
    letter-spacing: 0.025em;
  }
  .status-table-btn {
    padding: 0 4px;
  }
  .k-panelbar {
    border-radius: 6px;
  }

  .custom-tabstrip > div > ul > li > .k-link {
    border: none;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 10px;
  }

  .k-panelbar > .k-panelbar-header > .k-link,
  .k-panelbar > .k-item > .k-link.k-selected,
  .k-panelbar > .k-panelbar-header > .k-link.k-selected {
    color: #ffffff;
    border-radius: 6px;
    background-color: #4d80b3;
  }
  .tab-strip-class > div > ul > li {
    border: none;
    outline: none;
    padding: 2px 8px;
    border-top-left-radius: 6px !important;
    border-top-right-radius: 6px !important;
    margin-right: 5px;
    background: #e8e8e8;
  }
  .tab-strip-class > div > ul > li > span {
    font-size: 13px; !important;
  }
  .tab-strip-class > div > ul > li.k-active {
    color: #0d6efd;
    background: #0d6efd33;
  }
  .k-animation-container.k-animation-container-relative {
    width: 100%;
  }
`;
