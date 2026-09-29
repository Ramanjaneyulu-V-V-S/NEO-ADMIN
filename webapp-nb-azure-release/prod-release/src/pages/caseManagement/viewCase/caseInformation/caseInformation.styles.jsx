import styled from "styled-components";

export const DialogContent = styled.div`
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
  background: #fafbfc;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;

    &:hover {
      background: #a8a8a8;
    }
  }
`;

export const CaseInfoContainer = styled.div`
  padding: 20px;
  background: #ffffff;
  border-radius: 8px;
`;

export const CaseInfoRow = styled.div`
  display: flex;
  align-items: flex-start;
  font-size: 13px;
  padding: 0;
  margin-bottom: 8px;
  padding-bottom: 8px;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  &:nth-child(even) {
    background: #f8f9fa;
  }
`;

export const CaseInfoLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  flex: 0 0 35%;
  padding-right: 16px;
`;

export const CaseInfoValue = styled.div`
  font-size: 13px;
  word-break: break-word;
  flex: 1;
`;

export const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
`;
