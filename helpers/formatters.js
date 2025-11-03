// File: helpers/formatters.js
/**
 * Formats a slug-case channel name into Title Case.
 * e.g., "confetti-institute" -> "Confetti Institute"
 * @param {string} slug - The channel name
 * @returns {string} - The formatted name
 */
function formatChannelName(slug) {
  if (!slug) return null;
  return slug.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = { formatChannelName };
