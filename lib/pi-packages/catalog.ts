/**
 * pi 官方插件目录源:pi.dev/packages 画廊同源(npm registry 的
 * `pi-package` keyword 检索,registry.npmjs.org/-/v1/search)。
 * 5 分钟 revalidate 缓解限流;失败返回错误标记,UI 提供重试。
 */

export type PiCatalogItem = {
  date: string;
  description: string;
  keywords: string[];
  links: { npm?: string; repository?: string };
  name: string;
  publisher: string;
  version: string;
};

export type PiCatalogResult = {
  items: PiCatalogItem[];
  total: number;
};

const CATALOG_PAGE_SIZE = 20;
const CATALOG_REVALIDATE_SECONDS = 300;

type NpmSearchObject = {
  package: {
    date?: string;
    description?: string;
    keywords?: string[];
    links?: { npm?: string; repository?: string };
    name: string;
    publisher?: { username?: string };
    version?: string;
  };
};

function toCatalogItem(object: NpmSearchObject): PiCatalogItem {
  return {
    date: object.package.date ?? "",
    description: object.package.description ?? "",
    keywords: object.package.keywords ?? [],
    links: object.package.links ?? {},
    name: object.package.name,
    publisher: object.package.publisher?.username ?? "",
    version: object.package.version ?? "",
  };
}

export async function searchPiPackageCatalog(
  query: string,
  offset = 0
): Promise<PiCatalogResult> {
  // keyword 限定 pi-package(画廊收录条件);q 为空也保留 keyword 基线
  const text = query.trim()
    ? `keywords:pi-package ${query.trim()}`
    : "keywords:pi-package";
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=${CATALOG_PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`npm registry search failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    objects?: NpmSearchObject[];
    total?: number;
  };
  return {
    items: (payload.objects ?? []).map(toCatalogItem),
    total: payload.total ?? 0,
  };
}
