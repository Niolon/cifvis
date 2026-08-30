/**
 * Parses RFC-4180-style CSV text into objects keyed by the header row.
 * @param {string} text - CSV source
 * @returns {object[]} Parsed records
 */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n') {
            row.push(field.replace(/\r$/u, ''));
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (field || row.length) {
        row.push(field.replace(/\r$/u, ''));
        rows.push(row);
    }
    const header = rows.shift();
    return rows.filter(values => values.length === header.length).map(values =>
        Object.fromEntries(header.map((name, index) => [name, values[index]])));
}
