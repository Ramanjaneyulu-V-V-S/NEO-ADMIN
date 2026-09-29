//styled-components
import * as S from "./login.styles";

// images
import Logo from "../../assets/logo.svg";
import ECMLogo from "../../assets/logo.png";
import LeftContainerImg from "../../assets/left-container.webp";

// kendo components
import { Input } from "@progress/kendo-react-inputs";
import { Button } from "@progress/kendo-react-buttons";

// hooks & components
import { useLogin } from "./hooks/useLogin";

const Login = () => {
  const { formData, loading, error, isAccountBlocked, showPassword, capsLockWarning, handleChange, togglePasswordVisibility, handleSubmit, isFormValid } = useLogin();

  return (
    <S.LoginContainer>
      <div className="d-flex w-100 vh-100 overflow-hidden">
        <div className="d-none d-md-block w-50 position-relative overflow-hidden">
          <img src={LeftContainerImg} alt="Login illustration" className="left-container-img" />
        </div>

        <div className="d-flex flex-column align-items-center justify-content-center flex-fill position-relative p-4">
          <div className="position-absolute top-0 end-0 m-3 d-flex align-items-center gap-2">
            <img src={Logo} alt="nabard-logo" className="image-logo-nabard" />
          </div>

          <form className="login-form w-100" onSubmit={handleSubmit}>
            <div className="d-flex justify-content-center align-items-center mb-3">
              <img src={ECMLogo} alt="ecm-logo" className="image-logo-ecm" />
            </div>
            <div className="form-container">
              <p className="subtitle text-center fw-bold">Enter Your Login Credentials</p>
              <div className="mb-2 position-relative">
                <Input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="off"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Username"
                  className="login-popup-input w-100"
                  disabled={isAccountBlocked}
                />
              </div>
              <div className="mb-2 position-relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete="off"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  className="login-popup-input w-100"
                  disabled={isAccountBlocked}
                />
                <span className="eye-toggle-icon" onClick={togglePasswordVisibility}>
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </span>
              </div>

              {isAccountBlocked && (
                <p className="blocked-text mb-0">
                  Your account has been locked due to multiple incorrect password attempts. It will be reactivated after 15 minutes. <br /> If the issue persists , please raise a
                  support ticket. <br />
                  Thank you
                </p>
              )}

              {!isAccountBlocked && error && <p className="error-text mb-0">{error}</p>}

              {capsLockWarning && <p className="text-danger">Caps Lock is ON. Please check your input.</p>}

              <div className="text-end">
                <a href={import.meta.env.VITE_FORGOT_PASSWORD_URL} rel="noreferrer" className="font-size-12">
                  Forgot Password?
                </a>
              </div>

              <Button type="submit" className="submit-btn w-100 p-2 mt-3 text-white" disabled={loading || !isFormValid() || isAccountBlocked}>
                {loading ? "Logging in..." : "LOGIN"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </S.LoginContainer>
  );
};

export default Login;
