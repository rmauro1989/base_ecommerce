/** "Cable THHN 2,5 mm²" → "cable-thhn-2-5-mm2" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const slugSchemaRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
