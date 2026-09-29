//styled-component
import * as S from "./notFound.styles";

//images
import image from "../../assets/404.webp";

//custom component
import Layout from "../../components/layout/Layout";

const NotFound = () => {
  return (
    <Layout>
      <S.MainContainer className="d-flex align-items-center flex-column justify-content-center">
        <img src={image} alt="" />
        <div className="text-container notFound-title text-center p-2 mt-3">
          <h2 className="title mb-0">PAGE NOT FOUND !</h2>
        </div>
        <p className="sub-title text-center mt-3">Sorry, but the page you are looking for has not been found on our server.</p>
      </S.MainContainer>
    </Layout>
  );
};

export default NotFound;
