import { Button } from "@progress/kendo-react-buttons";
import CustomTooltip from "../customTooltip/CustomTooltip";

const ActionButton = ({ onClick, icon: Icon, title, tooltip, variant = "default" }) => {
  if (variant === "table" || tooltip) {
    return (
      <CustomTooltip tooltip={tooltip || title}>
        <Button className="status-table-btn ms-1" onClick={onClick}>
          <Icon size="12px" />
        </Button>
      </CustomTooltip>
    );
  }

  return (
    <button type="button" className="icon-wrapper icon-clickable border-0" onClick={onClick} title={title}>
      <Icon size="10px" />
    </button>
  );
};

export default ActionButton;
