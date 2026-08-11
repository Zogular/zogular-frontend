import type {
  DiscoveryQueryInput,
  DiscoveryQueryOptions,
  DiscoveryQueryPatch,
  DiscoveryQueryState,
  DiscoverySort,
} from "@/features/consumer-discovery/types/discovery.types";

export const DEFAULT_DISCOVERY_PAGE = 1;
export const MAX_DISCOVERY_PAGE = 10_000;
export const DEFAULT_DISCOVERY_SORT: DiscoverySort = "newest";

const DISCOVERY_SORTS = new Set<DiscoverySort>([
  "newest",
  "price_asc",
  "price_desc",
  "popular",
]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;
const MAX_SEARCH_LENGTH = 160;
const DEFAULT_DISCOVERY_PATH = "/products";
const RESET_PAGE_KEYS = new Set<keyof DiscoveryQueryPatch>([
  "categorySlug",
  "subcategorySlug",
  "search",
  "sort",
]);

type QueryValueSource = {
  getAll(name: string): string[];
};

function isQueryValueSource(value: DiscoveryQueryInput): value is QueryValueSource {
  return typeof (value as QueryValueSource).getAll === "function";
}

function readValues(input: DiscoveryQueryInput, key: string): string[] {
  if (isQueryValueSource(input)) return input.getAll(key);

  const value = input[key];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}

function readSingleValue(input: DiscoveryQueryInput, key: string): string | undefined {
  const values = readValues(input, key);
  return values.length === 1 ? values[0] : undefined;
}

function parseSlug(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized === "all" ||
    normalized.length > MAX_SLUG_LENGTH ||
    !SLUG_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function parseSearch(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > MAX_SEARCH_LENGTH) return undefined;
  return normalized;
}

function parsePage(value: string | undefined, maxPage: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return DEFAULT_DISCOVERY_PAGE;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= maxPage
    ? page
    : DEFAULT_DISCOVERY_PAGE;
}

function parseSort(
  value: string | undefined,
  allowPopular: boolean,
): DiscoverySort {
  if (!value || !DISCOVERY_SORTS.has(value as DiscoverySort)) {
    return DEFAULT_DISCOVERY_SORT;
  }
  if (value === "popular" && !allowPopular) return DEFAULT_DISCOVERY_SORT;
  return value as DiscoverySort;
}

function readCategorySlug(input: DiscoveryQueryInput): string | undefined {
  const categorySlugValues = readValues(input, "categorySlug");
  const categoryValues = readValues(input, "category");
  const values = [...categorySlugValues, ...categoryValues];
  return values.length === 1 ? parseSlug(values[0]) : undefined;
}

function normalizeOptions(options: DiscoveryQueryOptions = {}) {
  const maxPage = Number.isSafeInteger(options.maxPage) && (options.maxPage ?? 0) > 0
    ? Math.min(options.maxPage!, MAX_DISCOVERY_PAGE)
    : MAX_DISCOVERY_PAGE;
  return { allowPopular: options.allowPopular === true, maxPage };
}

export function parseDiscoveryQuery(
  input: DiscoveryQueryInput,
  options: DiscoveryQueryOptions = {},
): DiscoveryQueryState {
  const normalizedOptions = normalizeOptions(options);
  const categorySlug = readCategorySlug(input);
  const subcategorySlug = parseSlug(readSingleValue(input, "subcategorySlug"));
  const search = parseSearch(readSingleValue(input, "search"));
  const sort = parseSort(
    readSingleValue(input, "sort"),
    normalizedOptions.allowPopular,
  );
  const page = parsePage(
    readSingleValue(input, "page"),
    normalizedOptions.maxPage,
  );

  return {
    page,
    sort,
    ...(categorySlug ? { categorySlug } : {}),
    ...(subcategorySlug ? { subcategorySlug } : {}),
    ...(search ? { search } : {}),
  };
}

export function serializeDiscoveryQuery(
  state: DiscoveryQueryState,
  options: DiscoveryQueryOptions = {},
): string {
  const normalized = parseDiscoveryQuery(
    {
      page: String(state.page),
      sort: state.sort,
      categorySlug: state.categorySlug,
      subcategorySlug: state.subcategorySlug,
      search: state.search,
    },
    options,
  );
  const params = new URLSearchParams();

  if (normalized.categorySlug) params.set("categorySlug", normalized.categorySlug);
  if (normalized.subcategorySlug) {
    params.set("subcategorySlug", normalized.subcategorySlug);
  }
  if (normalized.search) params.set("search", normalized.search);
  if (normalized.sort !== DEFAULT_DISCOVERY_SORT) params.set("sort", normalized.sort);
  if (normalized.page !== DEFAULT_DISCOVERY_PAGE) params.set("page", String(normalized.page));

  return params.toString();
}

function normalizeInternalPathname(pathname: string, fallbackPathname: string): string {
  const fallback =
    fallbackPathname.startsWith("/") && !fallbackPathname.startsWith("//")
      ? fallbackPathname
      : DEFAULT_DISCOVERY_PATH;
  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    pathname.length > 2_048 ||
    /[\u0000-\u001f\u007f]/.test(pathname)
  ) {
    return fallback;
  }

  try {
    const decodedSegments = decodeURIComponent(pathname).split("/");
    return decodedSegments.some((segment) => segment === "." || segment === "..")
      ? fallback
      : pathname;
  } catch {
    return fallback;
  }
}

export function buildDiscoveryUrl(
  pathname: string,
  state: DiscoveryQueryState,
  options: DiscoveryQueryOptions & { fallbackPathname?: string } = {},
): string {
  const safePathname = normalizeInternalPathname(
    pathname,
    options.fallbackPathname ?? DEFAULT_DISCOVERY_PATH,
  );
  const query = serializeDiscoveryQuery(state, options);
  return query ? `${safePathname}?${query}` : safePathname;
}

export function updateDiscoveryQuery(
  current: DiscoveryQueryState,
  patch: DiscoveryQueryPatch,
  options: DiscoveryQueryOptions = {},
): DiscoveryQueryState {
  const candidate: Record<string, string | undefined> = {
    page: String(patch.page ?? current.page),
    sort: patch.sort ?? current.sort,
    categorySlug: patch.categorySlug ?? current.categorySlug,
    subcategorySlug: patch.subcategorySlug ?? current.subcategorySlug,
    search: patch.search ?? current.search,
  };

  for (const key of Object.keys(patch) as Array<keyof DiscoveryQueryPatch>) {
    if (patch[key] === null) candidate[key] = undefined;
  }

  const patched = parseDiscoveryQuery(candidate, options);
  const shouldResetPage = (Object.keys(patch) as Array<keyof DiscoveryQueryPatch>)
    .some((key) => RESET_PAGE_KEYS.has(key) && patched[key] !== current[key]);

  return shouldResetPage
    ? parseDiscoveryQuery({ ...candidate, page: String(DEFAULT_DISCOVERY_PAGE) }, options)
    : patched;
}

export function hasActiveDiscoveryQuery(state: DiscoveryQueryState): boolean {
  return Boolean(state.categorySlug || state.subcategorySlug || state.search);
}
