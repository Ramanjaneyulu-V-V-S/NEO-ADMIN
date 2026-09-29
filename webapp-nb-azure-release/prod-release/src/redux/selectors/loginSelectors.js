import { createSelector } from "@reduxjs/toolkit";

// Base selectors
export const selectLoginState = (state) => state.login;

// Memoized selectors
export const selectUserProfile = createSelector([selectLoginState], (login) => login.userProfile);
export const selectIsAuthenticated = createSelector([selectUserProfile], (userProfile) => !!userProfile);
export const selectUserProperties = createSelector([selectUserProfile], (userProfile) => userProfile?.properties || {});
export const selectUserName = createSelector([selectUserProperties], (properties) => properties.object_name);
export const selectUserRole = createSelector([selectUserProperties], (properties) => properties.user_role);
export const selectOfficeType = createSelector([selectUserProperties], (properties) => properties.office_type);
export const selectDepartmentShortCode = createSelector([selectUserProperties], (properties) => properties.department_short_code);
export const selectDepartmentName = createSelector([selectUserProperties], (properties) => properties.department_name);
export const selectRoShortCode = createSelector([selectUserProperties], (properties) => properties.ro_short_code);
export const selectDesignation = createSelector([selectUserProperties], (properties) => properties.designation);
export const selectLocation = createSelector([selectUserProperties], (properties) => properties.location);
export const selectUserUIN = createSelector([selectUserProperties], (properties) => properties.uin);
export const selectIsCGMUser = createSelector([selectLoginState], (login) => login.isCGMUser);
export const selectLoginLoading = createSelector([selectLoginState], (login) => login.loading);
export const selectLoginError = createSelector([selectLoginState], (login) => login.error);
export const selectDmdChairmanCondition = createSelector([selectLoginState], (login) => login.dmdChairmanCondition);

// Composite selectors for common use cases
export const selectUserContext = createSelector(
  [selectUserName, selectOfficeType, selectDepartmentShortCode, selectRoShortCode, selectDesignation],
  (objectName, officeType, departmentShortCode, roShortCode, designation) => ({
    objectName,
    officeType,
    departmentShortCode,
    roShortCode,
    designation,
  }),
);

export const selectUserDisplayInfo = createSelector([selectUserName, selectDepartmentName, selectDesignation, selectUserUIN], (objectName, departmentName, designation, uin) => ({
  objectName,
  departmentName,
  designation,
  uin,
}));
