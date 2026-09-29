import styled from "styled-components";

export const PopupContainer = styled.div`
  min-width: 200px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 0.25rem 1.25rem rgba(0, 0, 0, 0.15);
`;
export const Avatar = styled.img`
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 50%;
`;
export const UserName = styled.p`
  color: #333;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 0px;
`;
export const UserEmail = styled.span`
  color: #666;
  font-size: 11px;
`;
export const MenuItem = styled.div`
  gap: 12px;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  padding: 8px 15px;

  &:last-child {
    font-weight: bold;
    border-top: 1px solid rgb(232, 226, 226);
  }
`;
