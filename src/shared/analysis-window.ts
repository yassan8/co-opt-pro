export type AnalysisWindowKey =
  | 'system-data'
  | 'spot-diagram'
  | 'spherical-aberration'
  | 'astigmatism'
  | 'distortion'
  | 'distortion-grid'
  | 'magnification-chromatic-aberration'
  | 'integrated-aberration'
  | 'transverse-aberration'
  | 'opd'
  | 'psf'
  | 'mtf'
  | 'through-focus-spot'
  | 'through-focus-mtf'
  | 'field-mtf';

export const ANALYSIS_WINDOW_SIZE_MAP: Record<AnalysisWindowKey, { width: number; height: number; title: string }> = {
  'system-data': { width: 1200, height: 760, title: 'System Data' },
  'spot-diagram': { width: 980, height: 760, title: 'Spot Diagram' },
  'spherical-aberration': { width: 980, height: 760, title: 'Spherical Aberration' },
  'astigmatism': { width: 980, height: 760, title: 'Astigmatism' },
  'distortion': { width: 980, height: 760, title: 'Distortion' },
  'distortion-grid': { width: 980, height: 760, title: 'Distortion Grid' },
  'magnification-chromatic-aberration': { width: 980, height: 760, title: 'Lateral Chromatic Aberration' },
  'integrated-aberration': { width: 980, height: 760, title: 'Integrated Aberration' },
  'transverse-aberration': { width: 980, height: 760, title: 'Transverse Aberration' },
  'opd': { width: 980, height: 760, title: 'Optical Path Difference' },
  'psf': { width: 980, height: 760, title: 'Point Spread Function' },
  'mtf': { width: 980, height: 760, title: 'Modulation Transfer Function' },
  'through-focus-spot': { width: 1100, height: 820, title: 'Through-Focus Spot' },
  'through-focus-mtf': { width: 1100, height: 820, title: 'Through-Focus MTF' },
  'field-mtf': { width: 1100, height: 820, title: 'Object MTF' },
};

export const ANALYSIS_BUTTON_ID_MAP: Record<AnalysisWindowKey, string> = {
  'system-data': 'open-system-data-window-btn',
  'spot-diagram': 'open-spot-diagram-window-btn',
  'spherical-aberration': 'open-spherical-aberration-window-btn',
  'astigmatism': 'open-astigmatism-window-btn',
  'distortion': 'open-distortion-window-btn',
  'distortion-grid': 'open-distortion-grid-window-btn',
  'magnification-chromatic-aberration': 'open-magnification-chromatic-aberration-window-btn',
  'integrated-aberration': 'open-integrated-aberration-window-btn',
  'transverse-aberration': 'open-transverse-aberration-window-btn',
  'opd': 'open-opd-window-btn',
  'psf': 'open-psf-window-btn',
  'mtf': 'open-mtf-window-btn',
  'through-focus-spot': 'open-through-focus-spot-window-btn',
  'through-focus-mtf': 'open-through-focus-mtf-window-btn',
  'field-mtf': 'open-field-mtf-window-btn',
};

export const ANALYSIS_WEB_POPUP_MAP: Record<AnalysisWindowKey, { title: string; features: string }> = {
  'system-data': { title: 'System Data', features: 'width=1200,height=600' },
  'spot-diagram': { title: 'Spot Diagram', features: 'width=800,height=600' },
  'spherical-aberration': { title: 'Spherical Aberration', features: 'width=800,height=600' },
  'astigmatism': { title: 'Astigmatism', features: 'width=800,height=600' },
  'distortion': { title: 'Distortion', features: 'width=800,height=600' },
  'distortion-grid': { title: 'Distortion Grid', features: 'width=800,height=600' },
  'magnification-chromatic-aberration': { title: 'Lateral Chromatic Aberration', features: 'width=800,height=600' },
  'integrated-aberration': { title: 'Integrated Aberration', features: 'width=800,height=600' },
  'transverse-aberration': { title: 'Transverse Aberration', features: 'width=800,height=600' },
  'opd': { title: 'Optical Path Difference', features: 'width=800,height=600' },
  'psf': { title: 'Point Spread Function', features: 'width=800,height=600' },
  'mtf': { title: 'Modulation Transfer Function', features: 'width=800,height=600' },
  'through-focus-spot': { title: 'Through-Focus Spot', features: 'width=980,height=700' },
  'through-focus-mtf': { title: 'Through-Focus MTF', features: 'width=900,height=680' },
  'field-mtf': { title: 'Object MTF', features: 'width=900,height=650' },
};

export function asAnalysisWindowKey(value: string): AnalysisWindowKey | null {
  const key = String(value || '').trim() as AnalysisWindowKey;
  return key in ANALYSIS_WINDOW_SIZE_MAP ? key : null;
}
