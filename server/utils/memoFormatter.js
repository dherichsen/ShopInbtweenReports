/**
 * Format line-item custom attributes into a readable memo string
 * @param {Array} customAttributes - Array of custom attribute objects
 * @param {string} variantTitle - Optional variant title to prepend
 */
function formatMemo(customAttributes, variantTitle) {
  const parts = [];
  
  // Prepend variant title if it exists and is not empty
  if (variantTitle && variantTitle.trim() !== "") {
    parts.push(`Variant: ${variantTitle.trim()}`);
  }
  
  if (!customAttributes || customAttributes.length === 0) {
    console.log(`🔵 ORDERS - MemoFormatter: No custom attributes provided`);
    return parts.join("\n");
  }

  console.log(`🔵 ORDERS - MemoFormatter: Processing ${customAttributes.length} custom attributes`);
  console.log(`🔵 ORDERS - MemoFormatter: Raw attributes:`, JSON.stringify(customAttributes, null, 2));

  // Filter out empty values, has_gpo entries, and normalize
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
        key: normalizeKey(attr.key),
        value: normalizeValue(attr.value),
      };
      console.log(`🔵 ORDERS - MemoFormatter: Normalized "${attr.key}" -> "${normalized.key}" = "${normalized.value}"`);
      return normalized;
    });

  if (attributes.length === 0) {
    console.warn(`⚠️ ORDERS - MemoFormatter: All attributes were filtered out!`);
    return parts.join("\n");
  }
  
  console.log(`✅ ORDERS - MemoFormatter: ${attributes.length} attributes after filtering`);

  // Sort: known personalization keys first, then alphabetically
  const personalizationKeys = [
    "first name",
    "last name",
    "background",
    "font",
    "outline style",
    "font color",
    "text",
    "message",
    "customization",
  ];

  attributes.sort((a, b) => {
    const aKey = a.key.toLowerCase();
    const bKey = b.key.toLowerCase();
    
    const aIndex = personalizationKeys.findIndex(pk => aKey.includes(pk));
    const bIndex = personalizationKeys.findIndex(pk => bKey.includes(pk));
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.key.localeCompare(b.key);
  });

  // Add formatted attributes to parts
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

