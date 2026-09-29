import styled from "styled-components";

export const LoginContainer = styled.div`
  .image-logo-nabard {
    width: 70px;
  }
  .login-form {
    max-width: 400px;
    padding: 0 20px 20px 20px;
  }
  .image-logo-ecm {
    width: 180px;
    margin-bottom: 40px;
  }
  .form-container {
    margin-top: -60px;
  }
  .subtitle {
    color: #0099ff8f;
    font-size: 18px;
  }
  .login-popup-input {
    padding: 10px !important;
    border-radius: 8px;
    overflow: visible !important;
  }
  .login-popup-input .k-input-inner {
    padding-right: 35px !important;
  }
  .eye-toggle-icon {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    z-index: 2;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
  }
  .error-text {
    color: red;
    font-size: 13px;
  }
  .blocked-text {
    color: #b91c1c;
    font-size: 13px;
    background-color: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 8px;
  }
  .submit-btn {
    height: 35px;
    border-radius: 8px;
    background-color: #0099ff;
  }
  .left-container-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
`;
