import Swal from "sweetalert2";

export const showSweetAlert = ({ title, text, icon, ...rest }) => {
  Swal.fire({
    title,
    text,
    icon,
    ...rest,
    customClass: {
      icon: "custom-swal-icons",
      popup: "custom-swal-popup",
      title: "custom-swal-title",
      htmlContainer: "custom-swal-text",
      confirmButton: "common-btn-css submit-button",
      cancelButton: "common-btn-css cancel-button",
      ...(rest.customClass || {}),
    },
  });
};
