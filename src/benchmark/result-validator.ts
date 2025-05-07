/**
 * SQL Query Result Validator
 * 
 * Provides distance-based comparison methods to validate SQL query results.
 */

/**
 * Row and Result types for SQL data
 */
export type Row = Record<string, unknown>;
export type Result = Row[];

/**
 * Distance measurement type
 */
export enum DistanceKind {
  EXACT = 'exact',
  NUMERIC = 'numeric'
}

/**
 * Compare two SQL query results and return detailed comparison metrics
 */
export function compareResults(humanResult: any, llmResult: any): any {
  if (!humanResult.data || !llmResult.data) {
    return {
      matches: false,
      reason: "Missing data in results",
    };
  }

  const humanData = humanResult.data as Result;
  const llmData = llmResult.data as Result;

  // Handle empty results
  if (humanData.length === 0 && llmData.length === 0) {
    return {
      matches: true,
      details: "Both results are empty",
      distance: {
        exact: 0,
        numeric: 0,
        fScore: 1
      }
    };
  }

  // Calculate distance metrics
  const exactDistance = jaccardDistance(humanData, llmData);
  const numericDistance = numericRmseDistance(humanData, llmData);
  const fScore = 1 - fScoreDistance(humanData, llmData);
  
  // Exact match threshold (adjustable)
  const exactThreshold = 0.05;  // 5% difference allowed
  const numericThreshold = 0.1; // 10% difference allowed for numeric values
  
  const isExactMatch = exactDistance <= exactThreshold;
  const isNumericMatch = numericDistance <= numericThreshold;
  
  return {
    matches: isExactMatch || isNumericMatch,
    exactMatches: isExactMatch,
    numericMatches: isNumericMatch,
    distance: {
      exact: exactDistance,
      numeric: numericDistance,
      fScore: fScore
    },
    details: isExactMatch 
      ? "Results match within exact threshold" 
      : (isNumericMatch ? "Results match within numeric threshold" : "Results don't match"),
    humanRowCount: humanData.length,
    llmRowCount: llmData.length
  };
}

/**
 * Stable "row id" that is insensitive to column names / order
 */
function canonicalRow(r: Row): string {
  // Drop undefined / null values
  const vals = Object.values(r).filter(v => v !== undefined && v !== null);
  
  // Stringify scalars (numbers first so 10 < "z")
  const key = vals
    .map(v => typeof v === "number" ? `#${v}` : `${v}`)
    .sort()
    .join("|");
    
  return key;
}

/**
 * Try to read value as number, else NaN
 */
function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

/**
 * Calculate Jaccard distance between two result sets
 * (0 = identical, 1 = completely different)
 */
export function jaccardDistance(a: Result, b: Result): number {
  const setA = new Set(a.map(canonicalRow));
  const setB = new Set(b.map(canonicalRow));

  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

/**
 * Calculate F-score distance between two result sets
 * (0 = perfect match, 1 = no match)
 */
export function fScoreDistance(a: Result, b: Result, beta = 1): number {
  const setA = new Set(a.map(canonicalRow));
  const setB = new Set(b.map(canonicalRow));

  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;

  const precision = setA.size === 0 ? 0 : intersection / setA.size;
  const recall = setB.size === 0 ? 0 : intersection / setB.size;

  if (precision === 0 && recall === 0) return 1;

  const f = (1 + beta ** 2) * precision * recall /
            (beta ** 2 * precision + recall);

  return 1 - f; // 0 = perfect match
}

/**
 * Calculate numeric RMSE distance on aligned rows
 * (0 = identical, 1 = maximum difference)
 */
export function numericRmseDistance(a: Result, b: Result): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0 || b.length === 0) return 1;

  const sortKey = (row: Row) => canonicalRow(row);
  const A = [...a].sort((r1, r2) => sortKey(r1).localeCompare(sortKey(r2)));
  const B = [...b].sort((r1, r2) => sortKey(r1).localeCompare(sortKey(r2)));

  const k = Math.min(A.length, B.length);
  let se = 0, n = 0;

  for (let i = 0; i < k; i++) {
    const valsA = Object.values(A[i]);
    const valsB = Object.values(B[i]);
    const len = Math.min(valsA.length, valsB.length);

    for (let j = 0; j < len; j++) {
      const x = num(valsA[j]);
      const y = num(valsB[j]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const denom = (Math.abs(x) + Math.abs(y)) / 2 || 1;
        const delta = (x - y) / denom;       //  ↦ relative error
        se += delta ** 2;
        n++;
      }
    }
  }

  if (n === 0) return 1;          // no numeric overlap ⇒ maximal distance
  const rmse = Math.sqrt(se / n); // 0 … ∞
  return Math.min(rmse, 1);       // clamp so 0‑1 range matches set metrics
}

/**
 * Calculate distance between results based on specified kind
 */
export function distance(
  a: Result,
  b: Result,
  kind: DistanceKind = DistanceKind.EXACT
): number {
  return kind === DistanceKind.EXACT
    ? jaccardDistance(a, b)
    : numericRmseDistance(a, b);
} 