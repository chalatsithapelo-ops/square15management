export const OTHER_SERVICE_TYPE_VALUE = "__OTHER__";

export function resolveServiceType(serviceType: string, otherServiceType?: string): string {
  if (serviceType !== OTHER_SERVICE_TYPE_VALUE) return serviceType;
  return (otherServiceType ?? "").trim();
}

export function splitServiceType(
  persistedServiceType: string | null | undefined,
  knownServiceTypes: readonly string[]
): { serviceType: string; otherServiceType: string } {
  const value = (persistedServiceType ?? "").trim();

  if (!value) {
    return { serviceType: "", otherServiceType: "" };
  }

  if (knownServiceTypes.includes(value)) {
    return { serviceType: value, otherServiceType: "" };
  }

  return { serviceType: OTHER_SERVICE_TYPE_VALUE, otherServiceType: value };
}
