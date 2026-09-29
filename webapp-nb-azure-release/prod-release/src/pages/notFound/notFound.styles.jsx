import styled from "styled-components";

export const MainContainer = styled.div`
  height: 100vh;

  img {
    max-width: 100%;
    width: 400px;
  }
  .text-container {
    border-radius: 6px;
  }
  .notFound-title {
    min-width: 250px;
    background: #fa9f1b;
  }
  .maintenance-title {
    min-width: 350px;
    background: #0db7f0;
  }
  .title {
    font-size: 16px;
    font-weight: 900;
  }
  .sub-title {
    font-weight: 400;
    max-width: 600px;
  }
`;
