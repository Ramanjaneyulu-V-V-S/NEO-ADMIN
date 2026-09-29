import React, { useState, useRef } from "react";
import { Dialog, DialogActionsBar } from "@progress/kendo-react-dialogs";
import { Button } from "@progress/kendo-react-buttons";
import { showSweetAlert } from "../../../components/sweetAlert/SweetAlert";
import * as XLSX from "xlsx";
import validateExternalTemplate from "./validateExternalTemplate";

const templatePath = `${import.meta.env.VITE_BASE_PATH || ""}/templates/Bulk_Endorsement.xlsx`;
const BulkEndorsementDialog = ({ open, onClose, onFileUploaded, onNormalFlow, setLoader }) => {
  const [showBulkUploadOption, setShowBulkUploadOption] = useState(false);
  const bulkEndorsementFileInputRef = useRef(null);

  // Download Bulk Endorsement Template
  const handleDownloadBulkEndorsementTemplate = () => {
    const link = document.createElement("a");
    link.href = `${import.meta.env.VITE_BASE_PATH || ""}/templates/Bulk_Endorsement.xlsx`;
    link.download = "Bulk_Endorsement_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Parse Excel file and map to endorsement rows
  const parseBulkEndorsementFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Skip header row and map data
          const rows = jsonData.slice(1).map((row) => {
            const hoRoTe = row[0]?.toString().trim() || "";
            const selectedRecipients = row[1]?.toString().trim() || "";
            const taskCategory = row[2]?.toString().trim() || "";

            return {
              id: crypto.randomUUID(),
              type: "Internal",
              login_office_type: hoRoTe,
              selected_region: selectedRecipients,
              type_category: taskCategory,
              isInitial: false,
            };
          });

          // Filter out empty rows
          const validRows = rows.filter((row) => row.login_office_type && row.selected_region && row.type_category);

          resolve(validRows);
        } catch (error) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  // Handle bulk endorsement file upload
  const handleBulkEndorsementFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoader(true);

      // 1. Validate against master template
      const validationResult = await validateExternalTemplate(file, templatePath);

      if (!validationResult.valid) {
        showSweetAlert({
          title: validationResult.title || "Invalid File",
          text: validationResult.message,
          icon: "warning",
        });
        event.target.value = "";
        return;
      }

      // 2. Parse and Process
      const parsedRows = await parseBulkEndorsementFile(file);

      if (parsedRows.length === 0) {
        showSweetAlert({
          title: "No Valid Data",
          text: "The Excel file does not contain valid endorsement data. Please check the format.",
          icon: "warning",
        });
        event.target.value = "";
        return;
      }

      // Call parent callback with parsed rows
      onFileUploaded(parsedRows);
      setShowBulkUploadOption(false);

      showSweetAlert({
        title: "Success",
        text: `${parsedRows.length} endorsement row(s) loaded successfully from Excel.`,
        icon: "success",
      });
    } catch (error) {
      showSweetAlert({
        title: "Error",
        text: error.message || "Failed to process Excel file.",
        icon: "error",
      });
    } finally {
      setLoader(false);
      event.target.value = "";
    }
  };

  // Handle bulk endorsement dialog actions
  const handleBulkEndorsementChoice = (isBulk) => {
    if (isBulk) {
      // Show upload option instead of closing dialog
      setShowBulkUploadOption(true);
    } else {
      // Normal flow - close dialog
      onNormalFlow();
      setShowBulkUploadOption(false);
    }
  };

  // Handle Excel upload button click
  const handleBulkUploadClick = () => {
    if (bulkEndorsementFileInputRef.current) {
      bulkEndorsementFileInputRef.current.click();
    }
  };

  // Handle dialog close
  const handleClose = () => {
    setShowBulkUploadOption(false);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog title="Bulk Endorsement" onClose={handleClose} className="custom-dialog-width">
      {!showBulkUploadOption ? (
        <>
          <p className="mb-3">Do you want to do bulk endorsement?</p>
          <p className="mb-3 small text-muted">If Yes, you can upload an Excel file with columns: HO/RO/TE, Selected Recipients, Task Category</p>
          <DialogActionsBar>
            <div className="d-flex justify-content-between w-100">
              <Button onClick={handleDownloadBulkEndorsementTemplate} className="common-btn-css reset-button">
                Download Template
              </Button>
              <div className="d-flex gap-2">
                <Button onClick={() => handleBulkEndorsementChoice(false)} className="common-btn-css cancel-button">
                  No
                </Button>
                <Button onClick={() => handleBulkEndorsementChoice(true)} className="common-btn-css submit-button">
                  Yes
                </Button>
              </div>
            </div>
          </DialogActionsBar>
        </>
      ) : (
        <>
          <p className="mb-3">Upload Excel file for bulk endorsement</p>
          <p className="mb-3 small text-muted">Please upload an Excel file with columns: HO/RO/TE, Selected Recipients, Task Category</p>
          <input type="file" ref={bulkEndorsementFileInputRef} className="d-none" accept=".xlsx" onChange={handleBulkEndorsementFileUpload} />
          <DialogActionsBar>
            <div className="d-flex justify-content-between w-100">
              <Button onClick={handleDownloadBulkEndorsementTemplate} className="common-btn-css reset-button">
                Download Template
              </Button>
              <div className="d-flex gap-2">
                <Button
                  onClick={() => {
                    setShowBulkUploadOption(false);
                  }}
                  className="common-btn-css cancel-button"
                >
                  Back
                </Button>
                <Button onClick={handleBulkUploadClick} className="common-btn-css submit-button">
                  Upload Excel
                </Button>
              </div>
            </div>
          </DialogActionsBar>
        </>
      )}
    </Dialog>
  );
};

export default BulkEndorsementDialog;
