export function interpolate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (value, [name, replacement]) => value.split(`{${name}}`).join(String(replacement)),
    template,
  );
}
