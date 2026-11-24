export interface ManifestObject {
  [key: string]: ManifestValue;
}

export type ManifestValue = string | number | boolean | ManifestObject | ManifestValue[];

export interface RenderedManifest {
  [key: string]: ManifestValue;
  app: {
    id: string;
    runtime: { name: string };
    licensing?: ManifestObject;
  };
  permissions: { scopes: string[] };
  modules: Record<string, Array<Record<string, ManifestValue>>>;
  resources: Array<Record<string, ManifestValue>>;
}

export interface BaselineSnapshot {
  scopes: string[];
  modules: string[];
  approval: string[];
  evidence: string[];
}

export declare const APPROVED_SCOPES: readonly string[];
export declare const APPROVED_MODULES: readonly string[];
export declare const APPROVAL_IDS: readonly string[];
export declare const EVIDENCE_IDS: readonly string[];

export declare function modelBaseline(): BaselineSnapshot;

export declare function buildManifest(options: {
  appId: string;
  includeLicensing?: boolean;
}): RenderedManifest;

export declare function renderYaml(value: ManifestValue): string;

export declare function isParityCompatible(a: RenderedManifest, b: RenderedManifest): boolean;

export declare function baselineFindings(
  candidate: BaselineSnapshot,
  approved: BaselineSnapshot,
): string[];
