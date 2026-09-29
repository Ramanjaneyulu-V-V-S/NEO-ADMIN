import { useSelector } from "react-redux";
import { useDDMContext } from "./useDDMContext";

export const useInwardDropdownFields = () => {
  const { isDDM } = useDDMContext();

  const { dropdownData, sourceVerticalData } = useSelector((state) => state.digidakDropdown);
  const { type_category = [], received_from = [], state_of_sender = [], priority = [], secrecy = [], languages = [], mode_of_receipt = [] } = dropdownData || {};
  const secrecyOptions = isDDM ? secrecy.filter((item) => item.text === "Regular") : secrecy;
  const taskCategoryOptions = isDDM ? ["Information"] : type_category.map((i) => i.text);

  const fields = [
    {
      name: "receivedFrom",
      label: "Received From",
      data: received_from.map((i) => i.text),
    },
    {
      name: "taskCategory",
      label: "Task Category",
      data: taskCategoryOptions,
    },
    {
      name: "priority",
      label: "Priority",
      data: priority.map((i) => i.text),
    },

    {
      name: "secrecy",
      label: "Secrecy",
      data: secrecyOptions.map((i) => i.text),
    },
    {
      name: "language",
      label: "Language",
      data: languages.map((i) => i.text),
    },
    {
      name: "stateOfSender",
      label: "State of Sender",
      data: state_of_sender.map((i) => i.text),
    },
    {
      name: "modeOfReceipt",
      label: "Mode of Receipt",
      data: mode_of_receipt.map((i) => i.text),
    },
  ];

  if (!isDDM) {
    fields.push({
      name: "sourceVertical",
      label: "Vertical",
      data: sourceVerticalData,
    });
  }

  return { fields, isDDM };
};
