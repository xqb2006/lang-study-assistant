export const resourceImportErrorCodes = [
  "xml-invalid",
  "json-invalid",
  "stardict-64-bit",
  "stardict-no-entries",
  "epub-metadata-missing",
  "epub-chapter-missing",
  "wordnet-missing-file",
  "wordnet-no-entries",
  "gzip-archive",
  "gzip-unsupported-format",
  "gzip-invalid",
  "gzip-empty",
  "resource-no-entries",
] as const;

export type ResourceImportErrorCode = (typeof resourceImportErrorCodes)[number];

export class ResourceImportError extends Error {
  constructor(public readonly code: ResourceImportErrorCode, public readonly details: Record<string, string> = {}) {
    super(code);
    this.name = "ResourceImportError";
  }
}

export function resourceImportError(code: ResourceImportErrorCode, details: Record<string, string> = {}) {
  return new ResourceImportError(code, details);
}

export function isResourceImportError(error: unknown): error is ResourceImportError {
  return error instanceof ResourceImportError;
}
