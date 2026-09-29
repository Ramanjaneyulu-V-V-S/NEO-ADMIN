import styled from "styled-components";

export const MainContainer = styled.div`
  padding: 20px;
  border-radius: 8px;
  background-color: #ffffff;
  min-height: calc(100vh - 87px);
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);

  .case-form-label {
    font-size: 13px;
    font-weight: 600;
    margin-top: 10px;
  }
  .case-form-dropdown {
    background: transparent;
  }
`;

// CaseAction.styled.js
export const Wrapper = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: #fff;
  margin-top: 15px;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;
export const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid #dee2e6;

  button,
  span {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: #6c757d;
    font-weight: 500;
    transition:
      color 0.3s,
      border-color 0.3s;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    font-family: inherit;
    font-size: inherit;

    &.active {
      color: #0d6efd;
      border-bottom: 1px solid #0d6efd;
      background: #f8f9fa;
    }

    &:hover {
      color: #0d6efd;
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }
`;
export const Content = styled.div`
  height: 60px;
  padding: 1rem 1.25rem;

  .link-button {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: #0d6efd;
    font-weight: 500;
    cursor: pointer;
    font-size: 13px;
  }
`;
