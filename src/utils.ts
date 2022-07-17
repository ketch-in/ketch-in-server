export function logs(title: unknown, desc: unknown): void {
  console.log(title, desc);
}

export function toBoolean(data: unknown): boolean {
  if (typeof data === "string") {
    return data === "true";
  }
  if (typeof data === "boolean") {
    return data;
  }
  return !!data;
}

export function toString(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (!data) {
    return "";
  }
  return `${data}`;
}

export function createNewId(prevUserIds: string[] = []): string {
  const userId = (Math.random() * 100).toString().replace(".", "");
  if (prevUserIds.includes(userId)) {
    return createNewId(prevUserIds);
  }
  return userId;
}

export function parseExtra(
  params: { [key: string]: unknown } | string | undefined | null
): {
  [key: string]: unknown;
} {
  if (!params) {
    return {};
  }
  if (typeof params === "string") {
    try {
      return JSON.parse(params);
    } catch {
      return {
        value: params,
      };
    }
  }
  return params;
}
