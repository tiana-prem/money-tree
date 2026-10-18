import { useState } from 'react';
import { Armchair, Car, Home, ImageOff, Laptop, Package, Palmtree, Sparkles } from 'lucide-react';
import type { ProductCategory } from '../engine/types';

const ICONS: Record<ProductCategory, typeof Car> = {
  Electronics: Laptop, Transportation: Car, Furniture: Armchair, Housing: Home, Lifestyle: Sparkles, Travel: Palmtree, Other: Package,
};

/** Product photo with a loading shimmer and a graceful illustrated fallback if the image fails. */
export function ProductImage({ src, alt, category }: { src?: string; alt: string; category: ProductCategory }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error');
  const Icon = ICONS[category] ?? Package;
  return (
    <div className="product-img">
      {state === 'loading' && <div className="skeleton" aria-hidden />}
      {src && state !== 'error' && (
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" style={{ opacity: state === 'ok' ? 1 : 0 }} onLoad={() => setState('ok')} onError={() => setState('error')} />
      )}
      {state === 'error' && (
        <div className="fallback" role="img" aria-label={`${alt} (image unavailable)`}>
          <Icon size={34} strokeWidth={1.4} />
          {src && <span className="row" style={{ gap: 4 }}><ImageOff size={12} /> Image unavailable</span>}
        </div>
      )}
    </div>
  );
}
