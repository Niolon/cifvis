/**
 * Looks up neutral-atom anomalous dispersion factors from the internal IUCr
 * Cu Kalpha or Mo Kalpha tables.
 * @param {string} typeSymbol - Element symbol or atom-type label.
 * @param {number} wavelength - Radiation wavelength in Angstrom.
 * @param {object} options - Table override and wavelength tolerance.
 * @returns {{real:number, imaginary:number, table:string, wavelength:number}|null} Table value.
 */
export function lookupAnomalousDispersion(typeSymbol: string, wavelength: number, options?: object): {
    real: number;
    imaginary: number;
    table: string;
    wavelength: number;
} | null;
/**
 * Builds the model anomalous structure-factor contribution for each hkl.
 * CIF site values override CIF atom-type values, configured fallbacks, and
 * finally the internal complete Cu/Mo tables.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {number|string} cifBlock - Coordinate block index or name.
 * @param {object} options - Wavelength, table, and value overrides.
 * @param {object|null} expectedCell - Reflection cell required to match the model.
 * @returns {{coefficientAt:function(number,number,number):object, metadata:object}} Correction model.
 */
export function createAnomalousDispersionCorrection(cifText: string, cifBlock?: number | string, options?: object, expectedCell?: object | null): {
    coefficientAt: (arg0: number, arg1: number, arg2: number) => object;
    metadata: object;
};
//# sourceMappingURL=anomalous-dispersion.d.ts.map