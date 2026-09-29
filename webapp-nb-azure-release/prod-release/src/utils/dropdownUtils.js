export const mapDoUserToDropdownOption = (raw) => {
  if (typeof raw !== "string") {
    return { text: "", value: "" };
  }
  const parts = raw.split(",");
  const name = parts[1]?.trim();
  return {
    text: raw.trim(),
    value: name || raw.trim(),
  };
};
