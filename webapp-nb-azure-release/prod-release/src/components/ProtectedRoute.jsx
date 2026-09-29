import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { tokenManager } from "../services/auth/tokenManager";

const ProtectedRoute = ({ children }) => {
  const { userProfile } = useSelector((state) => state.login);

  // Allow access if:
  //  1. We have a rehydrated userProfile (Redux Persist), AND
  //  2. We have either an in-memory access token or an in-memory refresh token
  //     that can be exchanged on the first API call.
  if (!userProfile || !tokenManager.hasSession()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
