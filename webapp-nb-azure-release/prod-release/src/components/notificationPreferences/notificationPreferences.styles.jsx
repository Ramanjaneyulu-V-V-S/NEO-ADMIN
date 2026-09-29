import styled from "styled-components";

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  cursor: pointer;
`;
export const CheckboxInput = styled.input`
  margin-right: 12px;
  width: 18px;
  height: 18px;
  cursor: pointer;

  &:checked {
    accent-color: #007bff;
  }
`;
export const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  width: 100%;
`;
export const CheckboxIcon = styled.div`
  margin-right: 8px;
  color: #007bff;
  font-size: 18px;
`;
export const CheckboxText = styled.span`
  font-size: 13px;
  color: #333;
  line-height: 1.4;
`;
export const SectionTitle = styled.h6`
  color: #555;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 13px;
`;
export const Divider = styled.hr`
  border: none;
  margin: 16px 0;
  border-top: 1px solid #e0e0e0;
`;
