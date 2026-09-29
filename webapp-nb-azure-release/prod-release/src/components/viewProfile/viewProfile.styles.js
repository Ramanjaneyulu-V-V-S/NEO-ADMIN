import styled, { keyframes } from "styled-components";

export const Avatar = styled.img`
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 50%;
`;
export const UserName = styled.p`
  color: #333;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 0px;
`;
export const UserEmail = styled.span`
  color: #666;
  font-size: 13px;
`;
export const MenuItem = styled.div`
  gap: 12px;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  padding: 8px 15px;
`;
const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;
export const StatusText = styled.span`
  font-weight: 600;
  color: ${({ isActive }) => (isActive ? "green" : "red")};
  animation: ${blink} 1s infinite;
`;
