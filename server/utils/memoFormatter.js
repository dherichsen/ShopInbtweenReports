/**
 * Format line-item custom attributes into a readable memo string
 * @param {Array} customAttributes - Array of custom attribute objects
 * @param {Array} selectedOptions - Optional variant selected options (array of {name, value})
 */
function formatMemo(customAttributes, selectedOptions) {
  const parts = [];
  
  // Add variant selected options first (each on its own line with title)
  if (selectedOptions && Array.isArray(selectedOptions) && selectedOptions.length > 0) {
    for (const option of selectedOptions) {
      if (option.name && option.value && option.value.trim() !== "" && option.value !== "Default Title") {
        const fixedName = fixSpacing(option.name);
        const fixedValue = fixSpacing(option.value);
        parts.push(`${fixedName}: ${fixedValue}`);
      }
    }
  }
  
  if (!customAttributes || customAttributes.length === 0) {
    console.log(`🔵 ORDERS - MemoFormatter: No custom attributes provided`);
    return parts.join("\n");
  }

  console.log(`🔵 ORDERS - MemoFormatter: Processing ${customAttributes.length} custom attributes`);
  console.log(`🔵 ORDERS - MemoFormatter: Raw attributes:`, JSON.stringify(customAttributes, null, 2));

  // Filter out empty values, has_gpo entries, and normalize
  // PRESERVE ORIGINAL ORDER - no sorting
  const attributes = customAttributes
    .filter(attr => {
      const hasValue = attr && attr.value && attr.value.trim() !== "";
      if (!hasValue) {
        console.log(`⚠️ ORDERS - MemoFormatter: Filtering out empty attribute:`, attr.key);
        return false;
      }
      // Filter out has_gpo entries
      if (attr.key && attr.key.toLowerCase().includes("has_gpo")) {
        console.log(`⚠️ ORDERS - MemoFormatter: Filtering out has_gpo attribute:`, attr.key);
        return false;
      }
      if (attr.value && attr.value.toLowerCase().includes("has_gpo")) {
        console.log(`⚠️ ORDERS - MemoFormatter: Filtering out attribute with has_gpo value:`, attr.key);
        return false;
      }
      return true;
    })
    .map(attr => {
      const normalized = {
        key: fixSpacing(normalizeKey(attr.key)),
        value: fixSpacing(normalizeValue(attr.value)),
      };
      console.log(`🔵 ORDERS - MemoFormatter: Normalized "${attr.key}" -> "${normalized.key}" = "${normalized.value}"`);
      return normalized;
    });

  if (attributes.length === 0) {
    console.warn(`⚠️ ORDERS - MemoFormatter: All attributes were filtered out!`);
    return parts.join("\n");
  }
  
  console.log(`✅ ORDERS - MemoFormatter: ${attributes.length} attributes after filtering`);

  // Add formatted attributes to parts (preserving original order)
  const attributeLines = attributes.map(attr => `${attr.key}: ${attr.value}`);
  parts.push(...attributeLines);
  
  // Format as multi-line string
  const memo = parts.join("\n");
  console.log(`✅ ORDERS - MemoFormatter: Final memo (${memo.length} chars, ${attributes.length} attributes):`);
  console.log(`✅ ORDERS - MemoFormatter: Full memo content:\n${memo}`);
  console.log(`✅ ORDERS - MemoFormatter: Attribute keys in memo:`, attributes.map(a => a.key).join(", "));
  return memo;
}

/**
 * Fix spacing issues like "I N S I D E" -> "INSIDE"
 * Detects patterns where single characters are separated by single spaces
 */
function fixSpacing(text) {
  if (!text || typeof text !== "string") return text;
  
  // Pattern: single letters separated by single spaces (e.g., "I N S I D E")
  // This regex matches 2+ single uppercase letters separated by single spaces
  const spacedLettersPattern = /\b([A-Z](?:\s[A-Z]){2,})\b/g;
  
  return text.replace(spacedLettersPattern, (match) => {
    // Remove the spaces between the letters
    return match.replace(/\s/g, "");
  });
}

/**
 * Normalize attribute key names
 */
function normalizeKey(key) {
  if (!key) return "";
  
  // Convert camelCase/PascalCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Normalize attribute values
 * Attempts to parse JSON, handles arrays, etc.
 */
function normalizeValue(value) {
  if (!value) return "";
  
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.join(", ");
    }
    if (typeof parsed === "object") {
      return JSON.stringify(parsed, null, 2);
    }
    return String(parsed);
  } catch (e) {
    // Not JSON, return as-is
    return String(value).trim();
  }
}

module.exports = {
  formatMemo,
};

