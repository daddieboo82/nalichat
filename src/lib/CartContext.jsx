import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const cartStorageKey = `shopping_cart:${user?.id || 'anonymous'}`;
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const getCartIdentity = (product) => [
    product?.type || 'item',
    product?.id || product?.title || product?.name || 'unknown',
  ].join(':');

  useEffect(() => {
    let nextItems = [];
    try {
      const saved = localStorage.getItem(cartStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) nextItems = parsed;
      } else if (!user?.id) {
        // Migrate the old device-global cart only into the anonymous cart.
        // Never attribute legacy contents to a signed-in account on a shared device.
        const legacy = localStorage.getItem('shopping_cart');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            nextItems = parsed;
            localStorage.setItem(cartStorageKey, JSON.stringify(parsed));
          }
          localStorage.removeItem('shopping_cart');
        }
      }
    } catch {
      nextItems = [];
    }
    setItems(nextItems);
    setIsOpen(false);
  }, [cartStorageKey, user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(items));
    } catch {
      // Cart still works in-memory when browser storage is unavailable.
    }
  }, [cartStorageKey, items]);

  const addToCart = (product) => {
    const normalizedProduct = {
      ...product,
      ...(product?.id && !product?.type ? { type: 'stem_license' } : {}),
    };
    const nextIdentity = getCartIdentity(normalizedProduct);
    setItems(prev => {
      const existing = prev.find(item => getCartIdentity(item) === nextIdentity);
      if (existing) {
        return prev;
      }
      return [...prev, { ...normalizedProduct, quantity: 1 }];
    });
    setIsOpen(true);
    if (typeof window !== 'undefined' && window.gtag) {
      const convParams = { send_to: 'AW-18416125487/YZpUCNfY5OkcEK-Mv81E' };
      if (normalizedProduct.price > 0) { convParams.value = normalizedProduct.price; convParams.currency = 'USD'; }
      window.gtag('event', 'conversion', convParams);
    }
  };

  const removeFromCart = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, total, isOpen, setIsOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);