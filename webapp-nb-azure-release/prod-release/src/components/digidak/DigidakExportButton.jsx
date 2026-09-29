import { useCallback } from "react";
import { Button } from "@progress/kendo-react-buttons";
import { FaFileExport } from "react-icons/fa6";
import Swal from "sweetalert2";

const DigidakExportButton = ({ excelExportRef, data, className = "export-to-excel-btn common-btn-css" }) => {
  const handleExport = useCallback(() => {
    if (excelExportRef.current && data?.length > 0) {
      excelExportRef.current.save(data);
    } else {
      Swal.fire({
        icon: "warning",
        title: "Nothing to export",
        text: "There is no data available to export right now.",
      });
    }
  }, [excelExportRef, data]);

  return (
    <Button type="button" className={className} onClick={handleExport}>
      <FaFileExport className="me-1" size="14px" /> Export
    </Button>
  );
};

export default DigidakExportButton;
