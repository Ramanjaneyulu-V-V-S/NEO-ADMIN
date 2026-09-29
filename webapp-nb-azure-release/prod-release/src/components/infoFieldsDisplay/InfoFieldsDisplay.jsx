import { IoInformationCircleOutline } from "react-icons/io5";
import "./InfoFieldsDisplay.css";

const InfoFieldsDisplay = ({ fields = [], title = null, variant = "default", showIcon = false, className = "" }) => {
  const filteredFields = fields.filter(({ value }) => value);

  if (filteredFields.length === 0) {
    return null;
  }

  return (
    <div className={`info-fields-container ${variant} ${className}`}>
      {title && (
        <div className="info-fields-header">
          {showIcon && <IoInformationCircleOutline className="info-icon" />}
          <h6 className="info-fields-title">{title}</h6>
        </div>
      )}

      <div className="info-fields-grid" role="list" aria-label="Information fields">
        {filteredFields.map(({ label, value, icon: FieldIcon, type = "text" }) => (
          <div key={label} className="info-field-item" role="listitem" tabIndex="0">
            <div className="info-field-content">
              {FieldIcon && <FieldIcon className="field-icon" />}
              <div className="info-field-text">
                <span className="info-field-label" aria-label={`${label}:`}>
                  {label}:
                </span>
                <span className={`info-field-value ${type}`} aria-label={`${label} value: ${value}`}>
                  {value}
                </span>
              </div>
            </div>
            <div className="info-field-highlight"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfoFieldsDisplay;
