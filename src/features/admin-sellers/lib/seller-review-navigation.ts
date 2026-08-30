export const ADMIN_SELLER_QUEUE_PATH = "/admin/sellers";

export function canReturnToAdminSellerQueue(
  referrer: string,
  currentOrigin: string,
  historyLength: number,
): boolean {
  if (historyLength <= 1 || !referrer || !currentOrigin) return false;

  try {
    const previousUrl = new URL(referrer);
    return (
      previousUrl.origin === currentOrigin &&
      previousUrl.pathname === ADMIN_SELLER_QUEUE_PATH
    );
  } catch {
    return false;
  }
}
