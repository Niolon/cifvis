/**
 * Resolves the icon for a disorder filter mode. "all" always uses the
 * dedicated both-groups-in-black icon. Mode names encode rank and total
 * group count (e.g. "group1of2"), so when there are exactly two disorder
 * groups the mode name matches the dedicated two-tone group1of2/group2of2
 * artwork directly. With more than two groups there is no dedicated art
 * for each individual one, so the shared both-groups icon is reused in
 * grey with the group's rank overlaid in front of it.
 * @param {object} disorderIcons - The "disorder" category of an icon set, e.g. SVG_ICONS.disorder
 * @param {string} mode - Disorder filter mode
 * @returns {string} SVG markup for the icon
 */
export function getDisorderIcon(disorderIcons, mode) {
    if (mode === 'all') {
        return disorderIcons.all;
    }
    if (disorderIcons[mode]) {
        return disorderIcons[mode];
    }

    const rank = /^group(\d+)of\d+$/.exec(mode)?.[1];
    return rank ? generateDisorderGroupIcon(disorderIcons, rank) : '';
}

/**
 * Generates an icon for an individual disorder group when there is no
 * dedicated two-tone artwork for it: the shared both-groups icon,
 * recoloured grey, with the group's rank overlaid in front.
 * @param {object} disorderIcons - The "disorder" category of an icon set, e.g. SVG_ICONS.disorder
 * @param {string|number} groupNumber - Disorder group rank to display
 * @returns {string} SVG markup
 */
export function generateDisorderGroupIcon(disorderIcons, groupNumber) {
    const greyIcon = disorderIcons.all.replace(/#000000/g, '#8f8f8f');
    const label = '<text x="1.5" y="7" font-size="7" font-family="system-ui, sans-serif" ' +
        `font-weight="bold" fill="#000000">${groupNumber}</text>`;
    return greyIcon.replace('</svg>', `${label}</svg>`);
}
