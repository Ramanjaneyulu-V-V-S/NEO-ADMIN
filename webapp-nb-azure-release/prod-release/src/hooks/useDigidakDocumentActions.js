import { useCallback } from "react";
import Swal from "sweetalert2";
import { documentService } from "../services/caseManagement/documents/documentsService";

export const useDigidakDocumentActions = () => {
  // Download Document
  const handleDownload = useCallback(async (data) => {
    try {
      const blob = await documentService.downloadDocument(data.doc_id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", data.doc_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Delete Document
  const handleDelete = useCallback(async (data, onSuccess) => {
    await Swal.fire({
      title: "Delete Document",
      html: `Are you sure you want to delete <strong>${data.doc_name}</strong>?`,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "No",
      confirmButtonText: "Yes",
      customClass: {
        popup: "custom-swal-popup",
        title: "custom-swal-title",
        htmlContainer: "custom-swal-text",
        confirmButton: "common-btn-css submit-button",
        cancelButton: "common-btn-css cancel-button",
      },
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          const payload = {
            "run-stateless": "true",
            data: {
              variables: {
                inp_object_type: "cms_digidak_document",
                inp_object_id: data?.doc_id,
              },
            },
          };
          await documentService.deleteDocument(payload);

          // Execute callback if provided
          if (onSuccess) {
            await onSuccess();
          }
          return true;
        } catch (error) {
          Swal.showValidationMessage("Failed to delete the document.");
          console.error(error);
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });
  }, []);

  return { handleDownload, handleDelete };
};
