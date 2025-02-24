export default {
    'camera': {
        'minDistance': 1,
        'maxDistance': 100,
        'wheelZoomSpeed': 0.0008,
        'pinchZoomSpeed': 0.001,
        'initialPosition': [0, 0, 10],
        'fov': 45,
        'near': 0.1,
        'far': 1000,
    },
    'selection': {
        'mode': 'multiple',
        'markerMult': 1.3,
        'bondMarkerMult': 1.7,
        'markerSegments': 32,
        'highlightEmissive': 0xaaaaaa,
        'markerColors': [
            0x1f77b4,
            0xff7f0e,
            0x2ca02c,
            0xd62728,
            0x9467bd,
            0x8c564b,
            0xe377c2,
            0x7f7f7f,
            0xbcbd22,
            0x17becf,
        ],
    },
    'interaction': {
        'rotationSpeed': 5,
        'clickThreshold': 200,
        'mouseRaycast': {
            'lineThreshold': 0.5,
            'pointsThreshold': 0.5,
            'meshThreshold': 0.1,
        },
        'touchRaycast': {
            'lineThreshold': 2.0,
            'pointsThreshold': 2.0,
            'meshThreshold': 0.2,
        },
    },

    'renderMode': 'onDemand',

    // starting values for hydrogen, disorder and symmetry display
    'hydrogenMode': 'none',
    'disorderMode': 'all',
    'symmetryMode': 'bonds-no-hbonds-no',

    'bondGrowToleranceFactor': 1.2,

    'fixCifErrors': false,

    // atom visualisation Settings
    'atomDetail': 3,
    'atomColorRoughness': 0.3,
    'atomColorMetalness': 0.5,
    'atomADPRingWidthFactor': 1.0,
    'atomADPRingHeight': 0.06,
    'atomADPRingSections': 18,
    'atomADPInnerSections': 7,
    'atomConstantRadiusMultiplier': 0.25,

    // Bond visualisation settings
    'bondRadius': 0.05,
    'bondSections': 15,
    'bondColor': '#666666',
    'bondColorRoughness': 0.3,
    'bondColorMetalness': 0.1,

    // Hydrogen bond visualisation settings
    'hbondRadius': 0.04,         
    'hbondColor': '#AAAAAA',     
    'hbondColorRoughness': 0.3,  
    'hbondColorMetalness': 0.1,  
    'hbondDashSegmentLength': 0.3, // Target length for each dash+gap segment
    'hbondDashFraction': 0.6,    // Fraction of segment that is solid (vs gap)

    'elementProperties': {
        'H': { 'radius': 0.31, 'atomColor': '#ffffff', 'ringColor': '#000000' },
        'D': { 'radius': 0.31, 'atomColor': '#ffffff', 'ringColor': '#000000' },
        'He': { 'radius': 0.28, 'atomColor': '#d9ffff', 'ringColor': '#000000' },
        'Li': { 'radius': 1.28, 'atomColor': '#cc80ff', 'ringColor': '#000000' },
        'Be': { 'radius': 0.96, 'atomColor': '#c2ff00', 'ringColor': '#000000' },
        'B': { 'radius': 0.85, 'atomColor': '#ffb5b5', 'ringColor': '#000000' },
        'C': { 'radius': 0.76, 'atomColor': '#000000', 'ringColor': '#ffffff' },
        'N': { 'radius': 0.71, 'atomColor': '#3050f8', 'ringColor': '#ffffff' },
        'O': { 'radius': 0.66, 'atomColor': '#ff0d0d', 'ringColor': '#ffffff' },
        'F': { 'radius': 0.57, 'atomColor': '#90e050', 'ringColor': '#000000' },
        'Ne': { 'radius': 0.58, 'atomColor': '#b3e3f5', 'ringColor': '#000000' },
        'Na': { 'radius': 1.66, 'atomColor': '#ab5cf2', 'ringColor': '#ffffff' },
        'Mg': { 'radius': 1.41, 'atomColor': '#8aff00', 'ringColor': '#000000' },
        'Al': { 'radius': 1.21, 'atomColor': '#bfa6a6', 'ringColor': '#000000' },
        'Si': { 'radius': 1.11, 'atomColor': '#f0c8a0', 'ringColor': '#000000' },
        'P': { 'radius': 1.07, 'atomColor': '#ff8000', 'ringColor': '#000000' },
        'S': { 'radius': 1.05, 'atomColor': '#ffff30', 'ringColor': '#000000' },
        'Cl': { 'radius': 1.02, 'atomColor': '#1ff01f', 'ringColor': '#000000' },
        'Ar': { 'radius': 1.06, 'atomColor': '#80d1e3', 'ringColor': '#000000' },
        'K': { 'radius': 2.03, 'atomColor': '#8f40d4', 'ringColor': '#ffffff' },
        'Ca': { 'radius': 1.76, 'atomColor': '#3dff00', 'ringColor': '#000000' },
        'Sc': { 'radius': 1.7, 'atomColor': '#e6e6e6', 'ringColor': '#000000' },
        'Ti': { 'radius': 1.6, 'atomColor': '#bfc2c7', 'ringColor': '#000000' },
        'V': { 'radius': 1.53, 'atomColor': '#a6a6ab', 'ringColor': '#000000' },
        'Cr': { 'radius': 1.39, 'atomColor': '#8a99c7', 'ringColor': '#000000' },
        'Mn': { 'radius': 1.39, 'atomColor': '#9c7ac7', 'ringColor': '#000000' },
        'Fe': { 'radius': 1.32, 'atomColor': '#e06633', 'ringColor': '#ffffff' },
        'Co': { 'radius': 1.26, 'atomColor': '#f090a0', 'ringColor': '#000000' },
        'Ni': { 'radius': 1.24, 'atomColor': '#50d050', 'ringColor': '#000000' },
        'Cu': { 'radius': 1.32, 'atomColor': '#c88033', 'ringColor': '#000000' },
        'Zn': { 'radius': 1.22, 'atomColor': '#7d80b0', 'ringColor': '#000000' },
        'Ga': { 'radius': 1.22, 'atomColor': '#c28f8f', 'ringColor': '#000000' },
        'Ge': { 'radius': 1.2, 'atomColor': '#668f8f', 'ringColor': '#000000' },
        'As': { 'radius': 1.19, 'atomColor': '#bd80e3', 'ringColor': '#000000' },
        'Se': { 'radius': 1.2, 'atomColor': '#ffa100', 'ringColor': '#000000' },
        'Br': { 'radius': 1.2, 'atomColor': '#a62929', 'ringColor': '#ffffff' },
        'Kr': { 'radius': 1.16, 'atomColor': '#5cb8d1', 'ringColor': '#000000' },
        'Rb': { 'radius': 2.2, 'atomColor': '#702eb0', 'ringColor': '#ffffff' },
        'Sr': { 'radius': 1.95, 'atomColor': '#00ff00', 'ringColor': '#000000' },
        'Y': { 'radius': 1.9, 'atomColor': '#94ffff', 'ringColor': '#000000' },
        'Zr': { 'radius': 1.75, 'atomColor': '#94e0e0', 'ringColor': '#000000' },
        'Nb': { 'radius': 1.64, 'atomColor': '#73c2c9', 'ringColor': '#000000' },
        'Mo': { 'radius': 1.54, 'atomColor': '#54b5b5', 'ringColor': '#000000' },
        'Tc': { 'radius': 1.47, 'atomColor': '#3b9e9e', 'ringColor': '#000000' },
        'Ru': { 'radius': 1.46, 'atomColor': '#248f8f', 'ringColor': '#000000' },
        'Rh': { 'radius': 1.42, 'atomColor': '#0a7d8c', 'ringColor': '#000000' },
        'Pd': { 'radius': 1.39, 'atomColor': '#006985', 'ringColor': '#ffffff' },
        'Ag': { 'radius': 1.45, 'atomColor': '#c0c0c0', 'ringColor': '#000000' },
        'Cd': { 'radius': 1.44, 'atomColor': '#ffd98f', 'ringColor': '#000000' },
        'In': { 'radius': 1.42, 'atomColor': '#a67573', 'ringColor': '#000000' },
        'Sn': { 'radius': 1.39, 'atomColor': '#668080', 'ringColor': '#000000' },
        'Sb': { 'radius': 1.39, 'atomColor': '#9e63b5', 'ringColor': '#ffffff' },
        'Te': { 'radius': 1.38, 'atomColor': '#d47a00', 'ringColor': '#000000' },
        'I': { 'radius': 1.39, 'atomColor': '#940094', 'ringColor': '#ffffff' },
        'Xe': { 'radius': 1.4, 'atomColor': '#429eb0', 'ringColor': '#000000' },
        'Cs': { 'radius': 2.44, 'atomColor': '#57178f', 'ringColor': '#ffffff' },
        'Ba': { 'radius': 2.15, 'atomColor': '#00c900', 'ringColor': '#000000' },
        'La': { 'radius': 2.07, 'atomColor': '#70d4ff', 'ringColor': '#000000' },
        'Ce': { 'radius': 2.04, 'atomColor': '#ffffc7', 'ringColor': '#000000' },
        'Pr': { 'radius': 2.03, 'atomColor': '#d9ffc7', 'ringColor': '#000000' },
        'Nd': { 'radius': 2.01, 'atomColor': '#c7ffc7', 'ringColor': '#000000' },
        'Pm': { 'radius': 1.99, 'atomColor': '#a3ffc7', 'ringColor': '#000000' },
        'Sm': { 'radius': 1.98, 'atomColor': '#8fffc7', 'ringColor': '#000000' },
        'Eu': { 'radius': 1.98, 'atomColor': '#61ffc7', 'ringColor': '#000000' },
        'Gd': { 'radius': 1.96, 'atomColor': '#45ffc7', 'ringColor': '#000000' },
        'Tb': { 'radius': 1.94, 'atomColor': '#30ffc7', 'ringColor': '#000000' },
        'Dy': { 'radius': 1.92, 'atomColor': '#1fffc7', 'ringColor': '#000000' },
        'Ho': { 'radius': 1.92, 'atomColor': '#00ff9c', 'ringColor': '#000000' },
        'Er': { 'radius': 1.89, 'atomColor': '#00e675', 'ringColor': '#000000' },
        'Tm': { 'radius': 1.9, 'atomColor': '#00d452', 'ringColor': '#000000' },
        'Yb': { 'radius': 1.87, 'atomColor': '#00bf38', 'ringColor': '#000000' },
        'Lu': { 'radius': 1.87, 'atomColor': '#00ab24', 'ringColor': '#000000' },
        'Hf': { 'radius': 1.75, 'atomColor': '#4dc2ff', 'ringColor': '#000000' },
        'Ta': { 'radius': 1.7, 'atomColor': '#4da6ff', 'ringColor': '#000000' },
        'W': { 'radius': 1.62, 'atomColor': '#2194d6', 'ringColor': '#000000' },
        'Re': { 'radius': 1.51, 'atomColor': '#267dab', 'ringColor': '#000000' },
        'Os': { 'radius': 1.44, 'atomColor': '#266696', 'ringColor': '#ffffff' },
        'Ir': { 'radius': 1.41, 'atomColor': '#175487', 'ringColor': '#ffffff' },
        'Pt': { 'radius': 1.36, 'atomColor': '#d0d0e0', 'ringColor': '#000000' },
        'Au': { 'radius': 1.36, 'atomColor': '#ffd123', 'ringColor': '#000000' },
        'Hg': { 'radius': 1.32, 'atomColor': '#b8b8d0', 'ringColor': '#000000' },
        'Tl': { 'radius': 1.45, 'atomColor': '#a6544d', 'ringColor': '#ffffff' },
        'Pb': { 'radius': 1.46, 'atomColor': '#575961', 'ringColor': '#ffffff' },
        'Bi': { 'radius': 1.48, 'atomColor': '#9e4fb5', 'ringColor': '#ffffff' },
        'Po': { 'radius': 1.4, 'atomColor': '#ab5c00', 'ringColor': '#ffffff' },
        'At': { 'radius': 1.5, 'atomColor': '#754f45', 'ringColor': '#ffffff' },
        'Rn': { 'radius': 1.5, 'atomColor': '#428296', 'ringColor': '#000000' },
        'Fr': { 'radius': 2.6, 'atomColor': '#420066', 'ringColor': '#ffffff' },
        'Ra': { 'radius': 2.21, 'atomColor': '#007d00', 'ringColor': '#000000' },
        'Ac': { 'radius': 2.15, 'atomColor': '#70abfa', 'ringColor': '#000000' },
        'Th': { 'radius': 2.06, 'atomColor': '#00baff', 'ringColor': '#000000' },
        'Pa': { 'radius': 2.0, 'atomColor': '#00a1ff', 'ringColor': '#000000' },
        'U': { 'radius': 1.96, 'atomColor': '#008fff', 'ringColor': '#000000' },
        'Np': { 'radius': 1.9, 'atomColor': '#0080ff', 'ringColor': '#000000' },
        'Pu': { 'radius': 1.87, 'atomColor': '#006bff', 'ringColor': '#ffffff' },
        'Am': { 'radius': 1.8, 'atomColor': '#545cf2', 'ringColor': '#ffffff' },
        'Cm': { 'radius': 1.69, 'atomColor': '#785ce3', 'ringColor': '#ffffff' },
        'Bk': { 'radius': 1.65, 'atomColor': '#8a4fe3', 'ringColor': '#ffffff' }, 
        'Cf': { 'radius': 1.81, 'atomColor': '#a136d4', 'ringColor': '#ffffff' }, 
    },
};