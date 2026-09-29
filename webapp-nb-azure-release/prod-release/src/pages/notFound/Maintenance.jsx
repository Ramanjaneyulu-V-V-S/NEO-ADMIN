//styled-component
import * as S from "./notFound.styles";

//images
import image from "../../assets/maintenance.webp";

const Maintenance = () => {
  return (
    <S.MainContainer className="d-flex align-items-center flex-column justify-content-center">
      <img src={image} alt="" />
      <div className="text-container maintenance-title text-center p-2">
        <h2 className="title mb-0">WEBSITE UNDER MAINTENANCE...</h2>
      </div>
      <p className="sub-title text-center mt-3">Our website is currently undergoing scheduled maintenance. We should be back shortly. Thank you for your patience.</p>
    </S.MainContainer>
  );
};

export default Maintenance;
