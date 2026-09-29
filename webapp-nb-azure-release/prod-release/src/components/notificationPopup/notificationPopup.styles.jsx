import styled from "styled-components";

export const PopupContainer = styled.div`
  width: 300px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.15);
  max-height: 400px;
  display: flex;
  flex-direction: column;
`;
export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
`;
export const Title = styled.h3`
  margin: 0;
  color: #333;
  font-weight: 600;
  font-size: 13px;
`;
export const MarkAllReadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #28a745;
  font-size: 11px;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    color: #218838;
  }
`;
export const CheckIcon = styled.span`
  font-size: 13px;
  font-weight: bold;
`;
export const NotificationList = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
`;

export const GroupTitle = styled.div`
  color: #6c757d;
  font-size: 11px;
  font-weight: 500;
  padding: 0.5rem 1rem 0.25rem 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const NotificationItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  background: ${(props) => (props.isRead ? "#ffffff" : "#f0f8ff")};
  border-left: ${(props) => (props.isRead ? "none" : "3px solid #007bff")};
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.isRead ? "#f8f9fa" : "#e6f3ff")};
  }

  &:last-child {
    border-bottom: none;
  }
`;
export const NotificationIcon = styled.div`
  position: relative;
  flex-shrink: 0;

  &::after {
    content: "";
    position: absolute;
    top: -2px;
    right: -2px;
    width: 6px;
    height: 6px;
    background: #28a745;
    border-radius: 50%;
    border: 1px solid white;
    display: ${(props) => (props.isRead ? "none" : "block")};
  }
`;
export const NotificationContent = styled.div`
  flex: 1;
  min-width: 0;
`;
export const NotificationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
`;
export const NotificationTitle = styled.div`
  font-weight: ${(props) => (props.isRead ? "400" : "600")};
  color: #333;
  font-size: 11px;
  line-height: 1.3;
  flex: 1;
`;
export const TimeAgo = styled.div`
  color: #6c757d;
  font-size: 11px;
  margin-left: 0.5rem;
  flex-shrink: 0;
`;
export const NotificationMessage = styled.div`
  color: #495057;
  font-size: 11px;
  line-height: 1.4;
  margin-bottom: 0.25rem;
`;
export const SubText = styled.div`
  color: #6c757d;
  font-size: 11px;
  margin-bottom: 0;
`;
// Legacy styles for backward compatibility
export const Message = styled.p`
  color: #dd3c3c;
  font-weight: 500;
  margin-bottom: 0;
  font-size: 11px;
`;
