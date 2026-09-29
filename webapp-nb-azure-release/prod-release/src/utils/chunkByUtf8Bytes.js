// Documentum's `string_value` attribute caps at 2000 UTF-8 bytes per chunk.
// Multi-byte scripts (e.g. Devanagari = 3 bytes/char) overflow if we chunk by
// JS string length, which counts UTF-16 code units. This walks by code point
// and measures real UTF-8 byte length so a chunk never exceeds the cap and
// never splits inside a multi-byte sequence or a surrogate pair.

const DEFAULT_MAX_BYTES = 1900;

export const chunkByUtf8Bytes = (str, maxBytes = DEFAULT_MAX_BYTES) => {
  if (!str) return [""];

  const encoder = new TextEncoder();
  const chunks = [];
  let current = "";
  let currentBytes = 0;

  for (const ch of str) {
    const chBytes = encoder.encode(ch).length;

    if (currentBytes + chBytes > maxBytes && current) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }

    current += ch;
    currentBytes += chBytes;
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [""];
};
