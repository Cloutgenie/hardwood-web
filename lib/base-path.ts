export const BASE_PATH = "/hardwoodsim";

export function withBasePath(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${suffix}`;
}
