import Navbar from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartSyncBridge } from "@/components/cart/CartSyncBridge";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";
import { WishlistSyncBridge } from "@/components/wishlist/WishlistSyncBridge";

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-green-100">
      <Navbar />
      <CartSyncBridge />
      <WishlistSyncBridge />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <MobileBottomNavigation />
    </div>
  );
}
