import { useRef } from "react";
import PropTypes from "prop-types";

// styled-components
import * as S from "../../pages/caseManagement/createCase/createCase.styles";

// Kendo components
import { Button } from "@progress/kendo-react-buttons";

// Icons
import { FaCloudUploadAlt, FaRegFileAlt, FaCheckCircle } from "react-icons/fa";

const CaseAction = ({ tab, setTab, openEditor, createdNotesheet, handleFileUpload, selectedFile, previewNotesheet }) => {
  const fileInputRef = useRef(null);

  const renderTabs = () => (
    <S.Tabs>
      {[
        { id: "upload", label: "Upload File", icon: <FaCloudUploadAlt /> },
        { id: "notesheet", label: "Create Notesheet", icon: <FaRegFileAlt /> },
      ]?.map(({ id, label, icon }) => (
        <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
          {icon} {label}
        </button>
      ))}
    </S.Tabs>
  );

  const renderUploadSection = () => (
    <div className="section">
      {selectedFile ? (
        <div className="success">
          <FaCheckCircle /> {selectedFile.name}
        </div>
      ) : (
        <span className="fw-semibold">Upload a document</span>
      )}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          className="d-none"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileUpload}
        />
        <Button type="button" className="notesheet-upload-btn" onClick={() => fileInputRef.current?.click()}>
          {selectedFile ? "Re upload" : " Upload"}
        </Button>
      </div>
    </div>
  );

  const renderNotesheetSection = () => (
    <div className="section">
      {createdNotesheet ? (
        <div className="success">
          <FaCheckCircle /> Notesheet added
        </div>
      ) : (
        <span className="fw-semibold">Create notesheet</span>
      )}

      <div>
        <Button type="button" onClick={createdNotesheet ? previewNotesheet : openEditor} className="notesheet-upload-btn">
          {createdNotesheet ? " Preview" : "Editor"}
        </Button>
      </div>
    </div>
  );

  return (
    <S.Wrapper>
      {renderTabs()}
      <S.Content>{tab === "upload" ? renderUploadSection() : renderNotesheetSection()}</S.Content>
    </S.Wrapper>
  );
};

CaseAction.propTypes = {
  tab: PropTypes.string,
  setTab: PropTypes.func,
  openEditor: PropTypes.func,
  createdNotesheet: PropTypes.bool,
  handleFileUpload: PropTypes.func,
  selectedFile: PropTypes.object,
  previewNotesheet: PropTypes.func,
};

export default CaseAction;
