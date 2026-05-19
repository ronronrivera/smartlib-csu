// Purpose: Shared borrower-name formatting helpers used by UI and export mappers.
// Parts: normalized name-part extraction and full-name formatting.
export const getBorrowerNameParts = (borrower = {}) => ({
  firstName: String(borrower.firstName || borrower.first_name || "").trim(),
  lastName: String(borrower.lastName || borrower.last_name || "").trim(),
  nameSuffix: String(borrower.nameSuffix || borrower.suffix || "").trim()
});

export const formatBorrowerFullName = (
  borrower = {},
  { emptyValue = "-" } = {}
) => {
  const { firstName, lastName, nameSuffix } = getBorrowerNameParts(borrower);
  const baseName = [lastName, firstName].filter(Boolean).join(", ");
  if (!baseName) return emptyValue;

  return nameSuffix ? `${baseName} ${nameSuffix}` : baseName;
};

// Format student ID to insert a hyphen after the first 3 digits: 24101231 -> 241-01231
export const formatStudentId = (id, { emptyValue = "-" } = {}) => {
  const raw = String(id || "").trim();
  if (!raw) return emptyValue;
  // If already formatted like 123-45678, return as-is
  if (/^\d{3}-/.test(raw)) return raw;
  // Extract digits to preserve leading zeros
  const digits = raw.replace(/\D/g, "");
  if (!digits) return emptyValue;
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};
