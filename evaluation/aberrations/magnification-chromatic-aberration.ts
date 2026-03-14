import { calculateChiefRayNewton } from './transverse-aberration.ts';
import { preloadRustRayTracingWasm } from '../../rust-wasm/ts/raytracing/rust-raytracing-wasm.ts';

function isCoordTransRowForLca(row: any): boolean {
    const raw = String(row?.surfType ?? row?.['surf type'] ?? row?.type ?? row?.surface_type ?? '').trim().toLowerCase();
    const compact = raw.replace(/[\s_-]+/g, '');
    return raw === 'coord trans' || raw === 'coordinate transform' || compact === 'coordtrans' || compact === 'coordinatebreak' || compact === 'ct';
}

function isObjectRowForLca(row: any): boolean {
    const raw = String(row?.['object type'] ?? row?.object ?? row?.Object ?? row?.type ?? '').trim().toLowerCase();
    return raw === 'object' || raw === 'obj';
}

function isGapRowForLca(row: any): boolean {
    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
    const compact = (v: any) => norm(v).replace(/[\s_-]+/g, '');
    const surfType = norm(row?.surfType ?? row?.['surf type'] ?? row?.type ?? row?.surface_type ?? '');
    const surfTypeCompact = compact(row?.surfType ?? row?.['surf type'] ?? row?.type ?? row?.surface_type ?? '');
    const blockType = norm(row?._blockType ?? row?.blockType ?? '');
    const blockTypeCompact = compact(row?._blockType ?? row?.blockType ?? '');
    const kind = norm(row?.kind ?? '');
    const kindCompact = compact(row?.kind ?? '');
    return (
        surfType === 'gap' || surfType === 'air gap' || surfTypeCompact === 'gap' || surfTypeCompact === 'airgap' ||
        blockType === 'gap' || blockType === 'air gap' || blockTypeCompact === 'gap' || blockTypeCompact === 'airgap' ||
        kind === 'gap' || kind === 'air gap' || kindCompact === 'gap' || kindCompact === 'airgap'
    );
}

function surfaceIndexToRayPathPointIndexForLca(opticalSystemRows: any[], surfaceIndex: number): number | null {
    if (!Array.isArray(opticalSystemRows) || surfaceIndex === null || surfaceIndex === undefined) return null;
    const sIdx = Math.max(0, Math.min(surfaceIndex, opticalSystemRows.length - 1));
    let count = 0;
    for (let i = 0; i <= sIdx; i++) {
        const row = opticalSystemRows[i];
        if (isCoordTransRowForLca(row)) continue;
        if (isObjectRowForLca(row)) continue;
        if (isGapRowForLca(row)) continue;
        count++;
    }
    return count > 0 ? count : null;
}

function readAnyProp(source: any, keys: string[]): any {
    if (!source) return undefined;
    for (const key of keys) {
        if (source instanceof Map && source.has(key)) return source.get(key);
        if (typeof source === 'object' && key in source) return (source as any)[key];
    }
    return undefined;
}

function toArrayMaybe(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value instanceof Float64Array) return Array.from(value);
    if (value && typeof value[Symbol.iterator] === 'function' && typeof value !== 'string') {
        try { return Array.from(value as any); } catch (_) { return []; }
    }
    return [];
}

function normalizeRustLcaEntry(raw: any): any | null {
    if (!raw) return null;
    const wavelengthRaw = readAnyProp(raw, ['wavelength', 'lambda', 'wavelength_um', 'wavelengthUm']);
    const displacementsRaw = readAnyProp(raw, ['displacements', 'displacement', 'disp']);
    const imageHeightsRaw = readAnyProp(raw, ['imageHeights', 'image_heights', 'heights']);

    const wavelength = Number(wavelengthRaw);
    const displacements = toArrayMaybe(displacementsRaw);
    const imageHeights = toArrayMaybe(imageHeightsRaw);

    if (!Number.isFinite(wavelength)) return null;
    return {
        wavelength,
        displacements,
        imageHeights,
    };
}

function extractChiefRaySegmentsForLca(chief: any): any[] {
    if (!chief || typeof chief !== 'object') return [];
    const direct = Array.isArray(chief?.segments) ? chief.segments : null;
    if (direct && direct.length) return direct;
    const rayData = Array.isArray(chief?.rayData?.segments) ? chief.rayData.segments : null;
    if (rayData && rayData.length) return rayData;
    const rayPath = Array.isArray(chief?.ray?.path) ? chief.ray.path : null;
    if (rayPath && rayPath.length) return rayPath;
    return [];
}

function isInfiniteConjugateForLca(opticalSystemRows: any[]): boolean {
    if (!Array.isArray(opticalSystemRows) || opticalSystemRows.length === 0) return false;
    const first = opticalSystemRows[0] || {};
    const raw = first?.thickness ?? first?.Thickness ?? first?.distance;
    if (raw === Infinity) return true;
    const s = String(raw ?? '').trim().toLowerCase();
    return s === 'inf' || s === 'infinity';
}

function estimateObjectDistanceForLca(opticalSystemRows: any[]): number {
    if (!Array.isArray(opticalSystemRows) || opticalSystemRows.length === 0) return 0;
    const first = opticalSystemRows[0] || {};
    const n = Number(first?.thickness ?? first?.Thickness ?? first?.distance ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function mirrorSignForLca(opticalSystemRows: any[]): number {
    if (!Array.isArray(opticalSystemRows) || opticalSystemRows.length === 0) return 1;
    let mirrorCount = 0;
    for (const row of opticalSystemRows) {
        const material = String(row?.material ?? row?.glass ?? '').trim().toLowerCase();
        const surfType = String(row?.surfType ?? row?.['surf type'] ?? row?.type ?? row?.surfaceType ?? '').trim().toLowerCase();
        const blockType = String(row?._blockType ?? row?.blockType ?? '').trim().toLowerCase();
        const isMirror = material === 'mirror' || surfType === 'mirror' || blockType === 'mirror';
        if (isMirror) mirrorCount += 1;
    }
    return (mirrorCount % 2) === 1 ? -1 : 1;
}

function buildFieldObjectRowsForLca(fieldValues: number[], heightMode: boolean, finiteSystem: boolean, objectDistance: number): any[] {
    return fieldValues.map((sample, idx) => {
        if (heightMode) {
            return {
                id: `Field-${idx}`,
                name: `Field-${idx}`,
                position: 'Rectangle',
                xHeight: 0,
                yHeight: sample,
                x: 0,
                y: sample,
            };
        }
        if (finiteSystem) {
            const thetaRad = sample * Math.PI / 180.0;
            const yHeight = objectDistance * Math.tan(thetaRad);
            return {
                id: `Field-${idx}`,
                name: `Field-${idx}`,
                position: 'Rectangle',
                xHeight: 0,
                yHeight,
                x: 0,
                y: yHeight,
            };
        }
        return {
            id: `Field-${idx}`,
            name: `Field-${idx}`,
            position: 'Angle',
            xHeightAngle: 0,
            yHeightAngle: sample,
            x: 0,
            y: sample,
        };
    });
}

function parseFieldIndexFromLabelForLca(label: any): number | null {
    const m = String(label ?? '').match(/Field-(\d+)/i);
    if (!m) return null;
    const idx = Number(m[1]);
    return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

function extractFieldIndexFromSpotSeriesForLca(seriesRow: any, fallbackIndex: number, fieldCount: number): number {
    const direct = Number(seriesRow?.objectIndex);
    if (Number.isInteger(direct) && direct >= 0 && direct < fieldCount) return direct;

    const parsedFromLabel = parseFieldIndexFromLabelForLca(seriesRow?.label);
    if (parsedFromLabel !== null && parsedFromLabel >= 0 && parsedFromLabel < fieldCount) return parsedFromLabel;

    const parsedFromId = parseFieldIndexFromLabelForLca(seriesRow?.objectId);
    if (parsedFromId !== null && parsedFromId >= 0 && parsedFromId < fieldCount) return parsedFromId;

    // Do not silently fall back to array order here.
    // Misordered spot series can create zig-zag artifacts if we assign wrong field indices.
    return -1;
}

function lcaSelectImageHeightMmFromSpotSeries(series: any, chiefRayDefinition: string, mirrorSign: number): number | null {
    const mode = String(chiefRayDefinition || 'stop-center').toLowerCase();
    const points = Array.isArray(series?.points) ? series.points : [];

    if (mode.startsWith('beam-midpoint')) {
        let minY = Infinity;
        let maxY = -Infinity;
        for (const p of points) {
            const yUm = Number(p?.yUm);
            if (!Number.isFinite(yUm)) continue;
            if (yUm < minY) minY = yUm;
            if (yUm > maxY) maxY = yUm;
        }
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
        return ((minY + maxY) * 0.5 / 1000.0) * mirrorSign;
    }

    if (mode.startsWith('beam-centroid')) {
        let sum = 0;
        let count = 0;
        for (const p of points) {
            const yUm = Number(p?.yUm);
            if (!Number.isFinite(yUm)) continue;
            sum += yUm;
            count += 1;
        }
        if (count <= 0) return null;
        return ((sum / count) / 1000.0) * mirrorSign;
    }

    const yChiefUm = Number(series?.chiefPointUm?.yUm);
    return Number.isFinite(yChiefUm) ? ((yChiefUm / 1000.0) * mirrorSign) : null;
}

function computeImageHeightViaChiefRayForLca(
    opticalSystemRows: any[],
    fieldValue: number,
    wavelengthUm: number,
    imageSurfaceIndex: number,
    heightMode: boolean,
    finiteSystem: boolean,
    objectDistance: number,
    chiefRayDefinition: string,
    requireRustWasm: boolean,
    mirrorSign: number,
): number | null {
    const fieldSetting = (() => {
        if (heightMode) {
            return {
                position: 'height',
                fieldType: 'height',
                xHeight: 0,
                yHeight: fieldValue,
                x: 0,
                y: fieldValue,
                displayName: `h=${fieldValue.toFixed(6)}mm`
            };
        }

        if (finiteSystem) {
            const thetaRad = fieldValue * Math.PI / 180.0;
            const yHeight = objectDistance * Math.tan(thetaRad);
            return {
                position: 'rectangle',
                fieldType: 'rectangle',
                xHeight: 0,
                yHeight,
                x: 0,
                y: yHeight,
                displayName: `h=${yHeight.toFixed(6)}mm (from θ=${fieldValue.toFixed(6)}deg)`
            };
        }

        return {
            position: 'angle',
            fieldType: 'angle',
            xFieldAngle: 0,
            yFieldAngle: fieldValue,
            xHeightAngle: 0,
            yHeightAngle: fieldValue,
            x: 0,
            y: fieldValue,
            displayName: `θ=${fieldValue.toFixed(6)}deg`
        };
    })();

    const chief = calculateChiefRayNewton(opticalSystemRows, fieldSetting, wavelengthUm, 'unified', {
        targetSurfaceIndex: imageSurfaceIndex,
        chiefRayDefinition,
        requireRustWasm,
    });
    const segs = extractChiefRaySegmentsForLca(chief);
    if (!segs.length) return null;

    const mappedPointIndex = surfaceIndexToRayPathPointIndexForLca(opticalSystemRows, imageSurfaceIndex);
    const idx = Number.isInteger(mappedPointIndex)
        ? Math.max(0, Math.min(Number(mappedPointIndex), segs.length - 1))
        : Math.max(0, Math.min(imageSurfaceIndex, segs.length - 1));
    const p = segs[idx] || segs[segs.length - 1] || null;
    const y = Number(p?.y);
    return Number.isFinite(y) ? (y * mirrorSign) : null;
}

function normalizeRustLcaReducerResult(raw: any): Array<any> {
    if (!raw) return [];

    let value: any = raw;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch (_) {
            return [];
        }
    }

    const data = readAnyProp(value, ['dataByWavelength', 'data_by_wavelength']);
    if (Array.isArray(data)) {
        return data
            .map((entry) => normalizeRustLcaEntry(entry))
            .filter((entry) => !!entry);
    }

    if (data instanceof Map) {
        const fromMap = readAnyProp(data, ['items', 'values']);
        if (Array.isArray(fromMap)) {
            return fromMap
                .map((entry) => normalizeRustLcaEntry(entry))
                .filter((entry) => !!entry);
        }
    }

    return [];
}

function buildDisplacementStatsForLca(dataByWavelength: any[]): Array<any> {
    return (Array.isArray(dataByWavelength) ? dataByWavelength : []).map((entry) => {
        const wl = Number(entry?.wavelength);
        const disp = Array.isArray(entry?.displacements) ? entry.displacements : [];
        let finiteCount = 0;
        let maxAbs = 0;
        for (const v of disp) {
            const n = (typeof v === 'number') ? v : Number.NaN;
            if (!Number.isFinite(n)) continue;
            finiteCount += 1;
            const a = Math.abs(n);
            if (a > maxAbs) maxAbs = a;
        }
        return {
            wavelength: wl,
            finiteCount,
            maxAbsMm: maxAbs,
            maxAbsUm: maxAbs * 1000,
        };
    });
}

function fillMissingLinearForLca(fieldValues: number[], values: Array<number | null>): void {
    if (!Array.isArray(fieldValues) || !Array.isArray(values) || fieldValues.length !== values.length || values.length < 3) {
        return;
    }

    const knownIndices = values
        .map((value, index) => Number.isFinite(Number(value)) ? index : -1)
        .filter((index) => index >= 0);
    if (knownIndices.length < 2) return;

    const firstKnown = knownIndices[0];
    const lastKnown = knownIndices[knownIndices.length - 1];
    for (let i = firstKnown; i <= lastKnown; i++) {
        if (Number.isFinite(Number(values[i]))) continue;

        let left = i - 1;
        while (left >= firstKnown && !Number.isFinite(Number(values[left]))) left -= 1;
        if (left < firstKnown) continue;

        let right = i + 1;
        while (right <= lastKnown && !Number.isFinite(Number(values[right]))) right += 1;
        if (right > lastKnown) continue;

        const yLeft = Number(values[left]);
        const yRight = Number(values[right]);
        const xLeft = Number(fieldValues[left]);
        const xRight = Number(fieldValues[right]);
        const xNow = Number(fieldValues[i]);
        const dx = xRight - xLeft;
        if (!Number.isFinite(yLeft) || !Number.isFinite(yRight) || !Number.isFinite(dx) || Math.abs(dx) <= 1e-15) continue;
        const t = (xNow - xLeft) / dx;
        values[i] = yLeft + (yRight - yLeft) * t;
    }
}

function shouldFallbackToSpotRaytraceForLca(stats: any[], fieldCount: number, referenceWavelength: number): boolean {
    const nonReference = (Array.isArray(stats) ? stats : []).filter((entry) => {
        const wl = Number(entry?.wavelength);
        return Number.isFinite(wl) && Math.abs(wl - referenceWavelength) >= 1e-4;
    });
    if (nonReference.length === 0) return false;
    const minAcceptableFiniteCount = Math.max(3, Math.floor(fieldCount * 0.5));
    return nonReference.some((entry) => Number(entry?.finiteCount || 0) < minAcceptableFiniteCount);
}

function mergeLcaSeriesPreferNativeLike(
    nativeLikeSeries: any[],
    fallbackSeries: any[],
    fieldCount: number,
): any[] {
    const tol = 1e-4;
    const fallbackByWl = new Map<number, any>();
    for (const entry of (Array.isArray(fallbackSeries) ? fallbackSeries : [])) {
        const wl = Number(entry?.wavelength);
        if (!Number.isFinite(wl)) continue;
        fallbackByWl.set(wl, entry);
    }

    const pickFallback = (wavelength: number): any | null => {
        if (fallbackByWl.has(wavelength)) return fallbackByWl.get(wavelength);
        for (const [wl, entry] of fallbackByWl.entries()) {
            if (Math.abs(wl - wavelength) < tol) return entry;
        }
        return null;
    };

    return (Array.isArray(nativeLikeSeries) ? nativeLikeSeries : []).map((nativeEntry) => {
        const wl = Number(nativeEntry?.wavelength);
        const fallbackEntry = pickFallback(wl);

        const nativeDisp = Array.isArray(nativeEntry?.displacements) ? nativeEntry.displacements : [];
        const nativeHeights = Array.isArray(nativeEntry?.imageHeights) ? nativeEntry.imageHeights : [];
        const fallbackDisp = Array.isArray(fallbackEntry?.displacements) ? fallbackEntry.displacements : [];
        const fallbackHeights = Array.isArray(fallbackEntry?.imageHeights) ? fallbackEntry.imageHeights : [];

        const mergedDisplacements: Array<number | null> = new Array(fieldCount).fill(null);
        const mergedImageHeights: Array<number | null> = new Array(fieldCount).fill(null);

        for (let i = 0; i < fieldCount; i++) {
            const dNative = Number(nativeDisp[i]);
            const dFallback = Number(fallbackDisp[i]);
            mergedDisplacements[i] = Number.isFinite(dNative)
                ? dNative
                : (Number.isFinite(dFallback) ? dFallback : null);

            const hNative = Number(nativeHeights[i]);
            const hFallback = Number(fallbackHeights[i]);
            mergedImageHeights[i] = Number.isFinite(hNative)
                ? hNative
                : (Number.isFinite(hFallback) ? hFallback : null);
        }

        return {
            wavelength: wl,
            displacements: mergedDisplacements,
            imageHeights: mergedImageHeights,
        };
    });
}

function buildDefaultDistortionSourceRowsForLca(wavelengthUm: number): any[] {
    const wavelength = Number.isFinite(Number(wavelengthUm)) && Number(wavelengthUm) > 0 ? Number(wavelengthUm) : 0.5876;
    return [{
        id: 'DistortionPrimarySource',
        name: 'DistortionPrimarySource',
        wavelength,
        Wavelength: wavelength,
        weight: 1,
        primary: 'Primary Wavelength',
        isPrimary: true,
        color: '#22c55e',
    }];
}

async function computeWebSpotRaytraceLcaFallback(
    opticalSystemRows: any[],
    sortedFieldValues: number[],
    wavelengthCandidates: number[],
    sourceRows: any[],
    referenceWavelength: number,
    imageSurfaceIndex: number,
    heightMode: boolean,
    chiefRayDefinition: string,
    finiteSystem: boolean,
    objectDistance: number,
    mirrorSign: number,
    requireRustWasm: boolean,
) {
    const { runNativeSpotRaytrace } = await import('../../src/desktop/ipc/client.ts');
    const objectRows = buildFieldObjectRowsForLca(sortedFieldValues, heightMode, finiteSystem, objectDistance);

    const wavelengthHeights: Array<{ wavelength: number; imageHeights: Array<number | null> }> = [];
    for (const wavelength of wavelengthCandidates) {
        const spotResponse = await runNativeSpotRaytrace({
            opticalSystemRows,
            sourceRows: buildDefaultDistortionSourceRowsForLca(wavelength),
            objectRows,
            surfaceIndex: imageSurfaceIndex,
            rayCount: 101,
            ringCount: 1,
            pattern: 'cross',
            wavelengthMode: 'primary',
            raySeries: [],
        } as any);

        const imageHeights: Array<number | null> = new Array(sortedFieldValues.length).fill(null);
        const series = Array.isArray((spotResponse as any)?.series) ? (spotResponse as any).series : [];
        series.forEach((seriesRow: any, fallbackIndex: number) => {
            const fieldIndex = extractFieldIndexFromSpotSeriesForLca(seriesRow, fallbackIndex, sortedFieldValues.length);
            if (fieldIndex < 0 || fieldIndex >= imageHeights.length) return;
            imageHeights[fieldIndex] = lcaSelectImageHeightMmFromSpotSeries(seriesRow, chiefRayDefinition, mirrorSign);
        });

        wavelengthHeights.push({ wavelength, imageHeights });
    }

    const reference = wavelengthHeights.find((entry) => Math.abs(entry.wavelength - referenceWavelength) < 1e-4);
    if (!reference) return null;

    const dataByWavelength = wavelengthHeights.map((entry) => {
        const displacements: Array<number | null> = entry.imageHeights.map((height, index) => {
            const ref = reference.imageHeights[index];
            return Number.isFinite(Number(height)) && Number.isFinite(Number(ref))
                ? Number(height) - Number(ref)
                : null;
        });
        fillMissingLinearForLca(sortedFieldValues, displacements);
        return {
            wavelength: entry.wavelength,
            imageHeights: entry.imageHeights,
            displacements,
        };
    });

    return {
        backend: 'web-rust-wasm',
        fieldValues: sortedFieldValues,
        heightMode,
        referenceWavelength,
        imageSurfaceIndex,
        dataByWavelength,
        meta: {
            source: 'web-rust-wasm-spot-raytrace-fallback',
            finiteSystem,
            objectDistance,
            mirrorSign,
        },
        message: 'Computed via Web Rust/WASM spot raytrace fallback for LCA',
    };
}

function withWebRustWasmTraceOverride<T>(callback: () => Promise<T> | T, requireRustWasm = true): Promise<T> | T {
    const g: any = (typeof globalThis !== 'undefined') ? globalThis : null;
    if (!g) return callback();

    const key = '__cooptTraceOptionsOverride';
    const prev = g[key];
    const prevObj = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : null;
    g[key] = {
        ...(prevObj || {}),
        useRustWasm: true,
        requireRustWasm: !!requireRustWasm,
        // Keep Rust/WASM path, but avoid dropping all rays in strict forward-hit mode.
        requireForwardHit: false,
        allowNonStrict: true,
    };

    const restore = () => {
        if (prev === undefined) delete g[key];
        else g[key] = prev;
    };

    try {
        const out = callback();
        if (out && typeof (out as any).then === 'function') {
            return (out as Promise<T>).finally(() => {
                try { restore(); } catch (_) {}
            });
        }
        restore();
        return out;
    } catch (error) {
        restore();
        throw error;
    }
}

export async function calculateMagnificationChromaticAberrationData(
    opticalSystemRows,
    fieldValues,
    wavelengths,
    options: any = {}
) {
    const wavelengthEqTol = 1e-4;
    if (!Array.isArray(opticalSystemRows) || opticalSystemRows.length === 0) {
        console.error('❌ magnification chromatic aberration: opticalSystemRows invalid');
        return null;
    }
    if (!Array.isArray(fieldValues) || fieldValues.length === 0) {
        console.error('❌ magnification chromatic aberration: fieldValues empty');
        return null;
    }

    const referenceWavelengthInput = Number.isFinite(Number(options.referenceWavelength))
        ? Number(options.referenceWavelength)
        : 0.5876;
    const requireRustWasm = options?.requireRustWasm !== false;
    const heightMode = !!options.heightMode;
    const onProgress = (options && typeof options === 'object' && typeof options.onProgress === 'function')
        ? options.onProgress
        : null;
    const chiefRayDefinition = (options && typeof options === 'object' && typeof options.chiefRayDefinition === 'string')
        ? options.chiefRayDefinition
        : 'stop-center';
    const sourceRows = (options && typeof options === 'object' && Array.isArray(options.sourceRows))
        ? options.sourceRows
        : [];

    const sortedFieldValues = fieldValues
        .slice()
        .map(v => Number(v))
        .filter(v => Number.isFinite(v))
        .sort((a, b) => a - b);

    if (sortedFieldValues.length === 0) {
        console.error('❌ magnification chromatic aberration: no finite field values');
        return null;
    }

    const wavelengthCandidates = (Array.isArray(wavelengths) ? wavelengths : [])
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);

    // Collapse numerically-near wavelengths so 587.5618nm and 587.6nm are treated as one entry.
    const uniqueWavelengths: number[] = [];
    for (const wl of wavelengthCandidates) {
        if (!uniqueWavelengths.some(w => Math.abs(w - wl) < 1e-4)) {
            uniqueWavelengths.push(wl);
        }
    }
    wavelengthCandidates.length = 0;
    wavelengthCandidates.push(...uniqueWavelengths);

    // Treat nearly identical wavelengths as equivalent to avoid duplicate baseline traces
    // (e.g. source primary 0.5875618 vs default reference 0.5876).
    let referenceWavelength = referenceWavelengthInput;
    const nearRef = wavelengthCandidates.find(w => Math.abs(w - referenceWavelengthInput) < wavelengthEqTol);
    if (Number.isFinite(Number(nearRef))) {
        referenceWavelength = Number(nearRef);
    }

    if (!wavelengthCandidates.some(w => Math.abs(w - referenceWavelength) < wavelengthEqTol)) {
        wavelengthCandidates.push(referenceWavelength);
        wavelengthCandidates.sort((a, b) => a - b);
    }

    const pickImageSurfaceIndex = () => {
        if (!Array.isArray(opticalSystemRows) || opticalSystemRows.length === 0) return 0;
        let imageIdx = -1;
        for (let i = 0; i < opticalSystemRows.length; i++) {
            const row = opticalSystemRows[i] || {};
            const objectType = String(row?.['object type'] ?? row?.object ?? row?.Object ?? '').toLowerCase();
            if (objectType === 'image') imageIdx = i;
        }
        return imageIdx >= 0 ? imageIdx : Math.max(0, opticalSystemRows.length - 1);
    };

    const imageSurfaceIndex = pickImageSurfaceIndex();
    const finiteSystem = !isInfiniteConjugateForLca(opticalSystemRows);
    const objectDistance = estimateObjectDistanceForLca(opticalSystemRows);
    const mirrorSign = mirrorSignForLca(opticalSystemRows);

    const calcImageHeightFor = (fieldValue: number, wavelengthUm: number) => {
        return computeImageHeightViaChiefRayForLca(
            opticalSystemRows,
            fieldValue,
            wavelengthUm,
            imageSurfaceIndex,
            heightMode,
            finiteSystem,
            objectDistance,
            chiefRayDefinition,
            requireRustWasm,
            mirrorSign,
        );
    };

    try {
        const runtime = await import('../../src/desktop/runtime.ts');
        const useNative = runtime?.isTauriRuntime && runtime.isTauriRuntime();

        if (useNative) {
            try { onProgress?.({ percent: 5, message: 'Running native LCA...' }); } catch (_) {}
            const { runNativeMagnificationChromaticAberration } = await import('../../src/desktop/ipc/client.ts');
            const response = await runNativeMagnificationChromaticAberration({
                opticalSystemRows,
                sourceRows,
                fieldSamples: sortedFieldValues,
                wavelengths: wavelengthCandidates,
                referenceWavelength,
                heightMode,
                chiefRayDefinition,
            });

            if (!response || typeof response !== 'object') {
                throw new Error('Native LCA returned invalid response');
            }

            if (!String(response.backend || '').includes('native-rust')) {
                throw new Error(`Unexpected LCA backend: ${String(response.backend || 'unknown')}`);
            }

            try {
                const nativeStats = buildDisplacementStatsForLca((response as any)?.dataByWavelength || []);
                const fieldVals = Array.isArray((response as any)?.fieldValues) ? (response as any).fieldValues : [];
                console.log('📊 [LCA][Native] displacement stats:', nativeStats);
                console.log('📊 [LCA][Native] field range:', {
                    count: fieldVals.length,
                    min: fieldVals.length ? Math.min(...fieldVals) : null,
                    max: fieldVals.length ? Math.max(...fieldVals) : null,
                    heightMode,
                });
            } catch (_) {}

            try { onProgress?.({ percent: 100, message: 'Done' }); } catch (_) {}
            return response;
        }

        try { onProgress?.({ percent: 5, message: 'Running Web LCA...' }); } catch (_) {}

        const rustWasm = await preloadRustRayTracingWasm();
        const rustNativeLikeLca = (rustWasm as any)?.run_native_magnification_chromatic_aberration_wasm_json;
        if (typeof rustNativeLikeLca !== 'function') {
            throw new Error('Rust/WASM native-like LCA function not available: run_native_magnification_chromatic_aberration_wasm_json');
        }

        const rustReduced = await withWebRustWasmTraceOverride(async () => {
            return rustNativeLikeLca(JSON.stringify({
                opticalSystemRows,
                sourceRows,
                surfaceIndex: imageSurfaceIndex,
                fieldSamples: sortedFieldValues,
                wavelengths: wavelengthCandidates,
                referenceWavelength,
                heightMode,
                chiefRayDefinition,
            }));
        }, requireRustWasm);

        const dataByWavelength = normalizeRustLcaReducerResult(rustReduced);
        if (!dataByWavelength.length) {
            throw new Error('Rust/WASM native-like LCA returned empty dataByWavelength');
        }
        const nonRefCount = dataByWavelength.filter((entry) => {
            const wl = Number(entry?.wavelength);
            return Number.isFinite(wl) && Math.abs(wl - referenceWavelength) >= wavelengthEqTol;
        }).length;
        if (nonRefCount === 0) {
            console.warn('⚠️ LCA reducer returned no non-reference wavelength entries');
        }

        const displacementStats = buildDisplacementStatsForLca(dataByWavelength);
        try {
            console.log('📊 [LCA][Web] displacement stats:', displacementStats);
            console.log('📊 [LCA][Web] displacement stats json:', JSON.stringify(displacementStats));
            console.log('📊 [LCA][Web] field range:', {
                count: sortedFieldValues.length,
                min: sortedFieldValues.length ? Math.min(...sortedFieldValues) : null,
                max: sortedFieldValues.length ? Math.max(...sortedFieldValues) : null,
                heightMode,
            });
        } catch (_) {}

        try { onProgress?.({ percent: 100, message: 'Done' }); } catch (_) {}
        return {
            backend: 'web-rust-wasm',
            fieldValues: sortedFieldValues,
            heightMode,
            referenceWavelength,
            imageSurfaceIndex,
            dataByWavelength,
            meta: {
                source: 'rust-wasm-native-lca-direct',
                requireRustWasm,
                finiteSystem,
                objectDistance,
                mirrorSign,
                sourceRowCount: Array.isArray(sourceRows) ? sourceRows.length : 0,
                displacementStats,
            },
            message: 'Computed via Rust/WASM ray tracing + Rust/WASM LCA reduction on Web'
        };
    } catch (error) {
        console.error('❌ LCA failed:', error);
        return null;
    }
}
