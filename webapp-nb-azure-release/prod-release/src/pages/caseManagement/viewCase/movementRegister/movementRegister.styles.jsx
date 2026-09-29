import styled from "styled-components";

export const TimelineContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 15px 10px;
  max-width: 100%;
  margin: 0 auto;
`;
export const TimelineItem = styled.div`
  display: flex;
  align-items: flex-start;
  position: relative;
  padding-bottom: 30px;

  &:last-child {
    padding-bottom: 0;
  }

  &::after {
    content: "";
    position: absolute;
    left: 116.5px;
    top: 25px;
    bottom: 0;
    width: 2px;
    background-color: #e0e0e0;
    z-index: 1;
  }

  &:last-child::after {
    display: none;
  }
`;
export const TimeStamp = styled.div`
  width: 100px;
  text-align: right;
  padding-right: 15px;
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  padding-top: 3px;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
`;
export const Time = styled.span`
  font-weight: 600;
  color: #24447f;
  font-size: 13px;
`;
export const Period = styled.span`
  font-size: 11px;
  margin-top: 2px;
`;
export const Marker = styled.div`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #24447f;
  margin: 0 10px;
  z-index: 2;
  position: relative;
  top: 5px;
  flex-shrink: 0;
`;
export const Content = styled.div`
  flex: 1;
  padding-left: 15px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
  padding-top: 3px;
  max-width: calc(100% - 150px);
`;
export const StatusCard = styled.div`
  background-color: #f7faff;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  overflow: hidden;
  border: 1px solid #e0e8ff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  &:hover {
    background-color: #edf2ff;
  }
`;
export const StatusHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 8px 12px;
`;
export const StatusTitle = styled.div`
  font-weight: 600;
  color: #24447f;
  display: flex;
  align-items: center;
  font-size: 13px;
`;
export const TitleText = styled.span`
  margin-left: 8px;
`;
export const StatusSubtitle = styled.div`
  font-size: 11px;
  color: #555;
  font-weight: 400;
  margin-top: 2px;
  margin-left: 28px;
`;
export const StatusIcon = styled.div`
  color: #24447f;
  font-size: 18px;
`;
export const DetailItem = styled.div`
  margin-bottom: 8px;
  display: flex;
  font-size: 13px;

  &:last-child {
    margin-bottom: 0;
  }
`;
export const ExpandIcon = styled.div`
  margin-left: 10px;
  color: #24447f;
`;
export const DetailContainer = styled.div`
  padding: ${(props) => (props.isexpanded ? "10px 12px" : "0 12px")};
  max-height: ${(props) => (props.isexpanded ? "500px" : "0")};
  opacity: ${(props) => (props.isexpanded ? "1" : "0")};
  transition: all 0.3s ease;
  overflow: hidden;
  border-top: ${(props) => (props.isexpanded ? "1px solid #e0e8ff" : "none")};
  background-color: rgba(255, 255, 255, 0.5);
`;
export const DetailLabel = styled.div`
  color: #444;
  font-weight: 600;
  font-size: 13px;
  min-width: 120px;
`;
export const DetailValue = styled.div`
  flex: 1;
  color: #555;
  font-weight: 400;
`;
