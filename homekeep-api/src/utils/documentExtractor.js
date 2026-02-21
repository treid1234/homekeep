function extractAmount(text) {
    // matches $123, $123.45, 123.45, etc.
    const match = text.match(/\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (!match) return null;

    return Number(match[1].replace(/,/g, ""));
}

function extractDate(text) {
    // YYYY-MM-DD
    let match = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (match) return match[1];

    // MM/DD/YYYY or MM-DD-YYYY
    match = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/);
    if (match) return new Date(match[1]).toISOString().split("T")[0];

    return null;
}

function extractVendor(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // heuristic: first non-empty, non-numeric line
    for (const line of lines.slice(0, 5)) {
        if (!line.match(/\d/) && line.length > 3) {
            return line;
        }
    }

    return "";
}

export function extractFromText(text) {
    if (!text) {
        return { vendor: "", amount: null, date: null };
    }

    return {
        vendor: extractVendor(text),
        amount: extractAmount(text),
        date: extractDate(text)
    };
}
