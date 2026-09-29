import { Button } from "@progress/kendo-react-buttons";
import { useRef, useState } from "react";
import validateExternalTemplate from "./validateExternalTemplate";
import { FaCheckCircle } from "react-icons/fa";
import { documentService } from "../../../services/caseManagement/documents/documentsService";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";

const TEMPLATE_PATH = `${import.meta.env.VITE_BASE_PATH || ""}/templates/External_Bulk_Template.xlsx`;
const TEMPLATE_FILE_NAMES = ["External_Template.xlsx", "External_Bulk_Template.xlsx"];

export default function ExternalBulkUpload({ setValue, isGenerated }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = TEMPLATE_PATH;
    link.download = "External_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Path for external bulk upload
  const EXTERNAL_UPLOAD_FOLDER = "/Digidak Report/Digidak External Upload Excel";

  // Validation logic moved to `validateExternalTemplate` helper.
  const handleUploadTemplate = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx"].includes(ext)) {
      showSweetAlert({
        icon: "warning",
        title: "Invalid File",
        text: "Please upload the official Excel template (.xlsx) only.",
      });
      e.target.value = "";
      return;
    }

    try {
      // Validate file (extension + filename + header) against the official template
      const validationResult = await validateExternalTemplate(file, TEMPLATE_PATH, TEMPLATE_FILE_NAMES);
      if (!validationResult.valid) {
        showSweetAlert({
          icon: "warning",
          title: validationResult.title || "Invalid Template",
          text: validationResult.message || "Please upload the official External Bulk Template downloaded from the application.",
        });
        e.target.value = "";
        return;
      }

      setIsUploading(true);

      /* ---------------- Step 1: Get folder ID ---------------- */
      const folderRes = await documentService.getFolderIdByPath(EXTERNAL_UPLOAD_FOLDER);

      const folderId = folderRes?.data?.variables?.out_r_object_id?.[0];

      if (!folderId) {
        throw new Error("Folder ID not found for external bulk upload");
      }

      /* ---------------- Step 2: Upload file & get src ---------------- */
      const uploadRes = await documentService.getFilePath(file);
      const fileSrc = uploadRes?.entries?.[0]?.content?.src;

      if (!fileSrc) {
        throw new Error(`File upload failed for ${file.name}`);
      }

      /* ---------------- Step 3: Upload document ---------------- */
      const uploadPayload = {
        properties: {
          a_content_type: "excel12book",
          r_object_type: "dm_document",
          object_name: file.name,
          folder_id: folderId,
        },
        type: "dm_document",
        source: fileSrc,
      };

      await documentService.uploadDocument(uploadPayload);

      /* ---------------- Step 4: UI success ---------------- */
      showSweetAlert({
        icon: "success",
        title: "File Uploaded",
        text: `${file.name} uploaded successfully.`,
        timer: 2000,
        showConfirmButton: false,
      });

      setUploadedFile(file.name);
      setValue("externalFile", file, {
        shouldValidate: true,
      });
    } catch (error) {
      showSweetAlert({
        icon: "error",
        title: "Upload Failed",
        text: error?.message || "Something went wrong while uploading the file.",
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="col-xs-12 col-sm-8 col-md-4 mt-4">
      <Button type="button" className="reset-button me-2" onClick={handleDownloadTemplate}>
        Download Template
      </Button>

      <Button
        type="button"
        themeColor={uploadedFile ? "success" : "base"}
        className="reset-button"
        disabled={isUploading || isGenerated}
        onClick={() => fileInputRef.current.click()}
      >
        {isUploading ? "Uploading..." : uploadedFile ? "Reupload Excel" : "Upload Excel"}
      </Button>

      <input type="file" accept=".xlsx" ref={fileInputRef} className="d-none" onChange={handleUploadTemplate} />

      {uploadedFile && (
        <div className="mt-2 text-success d-flex align-items-center case-form-label">
          <FaCheckCircle className="me-1" />
          <span>{uploadedFile} uploaded</span>
        </div>
      )}
    </div>
  );
}
