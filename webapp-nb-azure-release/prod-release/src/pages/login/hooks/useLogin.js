import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { loginUser, clearError } from "../../../redux/login/loginSlice";
import { tokenManager } from "../../../services/auth/tokenManager";

export const useLogin = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: reduxError, isAccountBlocked } = useSelector((state) => state.login);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockWarning, setCapsLockWarning] = useState(false);

  useEffect(() => {
    // Clear any stale auth state on login page mount
    // tokenManager.clear() handles: legacy localStorage keys, sessionStorage,
    // in-memory tokens, and stale cookies (refreshToken, x-csrf-token)
    tokenManager.clear();

    dispatch(clearError());

    // Caps Lock detection
    const checkCapsLock = (e) => {
      if (e.getModifierState && e.getModifierState("CapsLock")) {
        setCapsLockWarning(true);
      } else {
        setCapsLockWarning(false);
      }
    };

    window.addEventListener("keydown", checkCapsLock);
    return () => {
      window.removeEventListener("keydown", checkCapsLock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "username" ? value.replace(/\s/g, "") : value,
    }));
    if (reduxError && !isAccountBlocked) dispatch(clearError());
    if (localError) setLocalError("");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isFormValid = () => {
    return formData.username.trim() !== "" && formData.password.trim() !== "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await dispatch(
      loginUser({
        username: formData.username,
        password: formData.password,
      }),
    );

    if (result.meta.requestStatus === "rejected" || result.payload?.status) {
      if (result.meta.requestStatus === "rejected" || result.payload?.status) {
        switch (result.payload?.message || result.payload?.error_description) {
          case "ACCOUNT_DISABLED":
            setLocalError("Your account is Inactive, kindly raise a ticket.");
            break;

          case "INVALID_CREDENTIALS":
            setLocalError("Invalid username or password. Please try again.");
            break;

          case "USER_NOT_FOUND":
            setLocalError("No account found with this username.");
            break;

          case "SERVER_ERROR":
            setLocalError("Something went wrong on our end. Please try again later.");
            break;

          default:
            setLocalError("Login failed. Please try again.");
        }
      }
    } else if (result.payload) {
      navigate("/dashboard");
    } else {
      setLocalError("Please check your username & password.");
    }
  };

  return {
    formData,
    loading,
    error: localError || reduxError,
    isAccountBlocked,
    showPassword,
    capsLockWarning,
    handleChange,
    togglePasswordVisibility,
    handleSubmit,
    isFormValid,
  };
};
