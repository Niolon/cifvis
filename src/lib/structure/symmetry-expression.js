/**
 * Parses an unsigned decimal or fraction without using an ambiguous regular expression.
 * @param {string} text - Numeric text without a leading sign.
 * @returns {number|null} Parsed value, or null when the text is not a supported number.
 */
function parseUnsignedNumber(text) {
    if (text.length === 0) {
        return null;
    }

    let slashIndex = -1;
    let decimalPointSeen = false;
    let digitsInPart = 0;
    let numeratorDigits = 0;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character >= '0' && character <= '9') {
            digitsInPart++;
            continue;
        }
        if (character === '.' && !decimalPointSeen) {
            decimalPointSeen = true;
            continue;
        }
        if (character === '/' && slashIndex === -1 && digitsInPart > 0) {
            slashIndex = index;
            numeratorDigits = digitsInPart;
            digitsInPart = 0;
            decimalPointSeen = false;
            continue;
        }
        return null;
    }

    if (digitsInPart === 0) {
        return null;
    }
    if (slashIndex === -1) {
        return Number(text);
    }
    if (numeratorDigits === 0) {
        return null;
    }

    const denominator = Number(text.slice(slashIndex + 1));
    return Number(text.slice(0, slashIndex)) / denominator;
}

/**
 * Parses one component of a crystallographic symmetry expression in linear time.
 * Unsupported terms are ignored, matching the historical parser's permissive behaviour.
 * @param {string} component - Component such as `-x+y+1/2`.
 * @returns {{coefficients: number[], translation: number}} Rotation coefficients and translation.
 */
export function parseSymmetryComponent(component) {
    const compactCharacters = [];
    for (const character of component) {
        if (character.trim() !== '') {
            compactCharacters.push(character.toUpperCase());
        }
    }
    const compact = compactCharacters.join('');

    const coefficients = [0, 0, 0];
    let translation = 0;
    let termStart = 0;

    for (let index = 1; index <= compact.length; index++) {
        const atEnd = index === compact.length;
        const character = compact[index];
        if (!atEnd && character !== '+' && character !== '-') {
            continue;
        }

        let term = compact.slice(termStart, index);
        termStart = index;
        if (term.length === 0) {
            continue;
        }

        let sign = 1;
        if (term[0] === '+' || term[0] === '-') {
            sign = term[0] === '-' ? -1 : 1;
            term = term.slice(1);
        }
        if (term.length === 0) {
            continue;
        }

        const axisIndex = 'XYZ'.indexOf(term[term.length - 1]);
        if (axisIndex !== -1) {
            let coefficientText = term.slice(0, -1);
            if (coefficientText.endsWith('*')) {
                coefficientText = coefficientText.slice(0, -1);
            }
            const magnitude = coefficientText === '' ? 1 : parseUnsignedNumber(coefficientText);
            if (magnitude !== null) {
                coefficients[axisIndex] = sign * magnitude;
            }
            continue;
        }

        const magnitude = parseUnsignedNumber(term);
        if (magnitude !== null) {
            translation += sign * magnitude;
        }
    }

    return { coefficients, translation };
}
