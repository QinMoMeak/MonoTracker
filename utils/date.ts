export const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const normalized = String(dateStr).trim();
  if (!normalized) return '';
  const directMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directMatch) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatMonth = (dateStr?: string) => {
  if (!dateStr) return '';
  const normalized = String(dateStr).trim();
  if (!normalized) return '';
  const directMatch = normalized.match(/^(\d{4})-(\d{2})/);
  if (directMatch) return `${directMatch[1]}-${directMatch[2]}`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};
