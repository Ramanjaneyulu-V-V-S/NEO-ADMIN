// CustomTooltip.js
import { useState } from "react";

const CustomTooltip = ({ children, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="custom-tooltip-wrapper" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      {children}
      {showTooltip && <div className="custom-tooltip-box">{tooltip}</div>}
    </div>
  );
};

export default CustomTooltip;
