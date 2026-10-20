'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { commerceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ShoppingBag, Star, CreditCard, Clock, Zap } from 'lucide-react';

interface Offer {
  id: string;
  code: string;
  kind: string;
  name: Record<string, string>;
  tagline: Record<string, string>;
  price: number;
  currency: string;
  credits: number;
  days: number;
  features: string[];
  is_highlighted: boolean;
  max_installments: number;
}

const kindIcons: Record<string, any> = {
  credits: CreditCard,
  unlimited_pass: Clock,
  course_access: Zap,
  pack: ShoppingBag,
};

export default function ShopPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    commerceApi.offers()
      .then((res) => setOffers(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'XAF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Offres & Formules
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Choisissez la formule qui correspond le mieux a vos besoins de formation et de certification.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((offer) => {
          const Icon = kindIcons[offer.kind] || ShoppingBag;
          return (
            <div
              key={offer.id}
              className={`relative rounded-2xl border p-6 transition-all hover:shadow-lg cursor-pointer ${
                offer.is_highlighted
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
              onClick={() => router.push(`/shop/${offer.code}`)}
            >
              {offer.is_highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Populaire
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${
                  offer.is_highlighted ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {offer.name?.fr || offer.name?.en || offer.code}
                </h3>
              </div>

              {offer.tagline?.fr && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {offer.tagline.fr}
                </p>
              )}

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(offer.price, offer.currency)}
                </span>
                {offer.max_installments > 1 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ou {offer.max_installments}x sans frais
                  </span>
                )}
              </div>

              {offer.features && offer.features.length > 0 && (
                <ul className="space-y-2 mb-6">
                  {(offer.features as string[]).map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-green-500 mt-0.5">&#10003;</span>
                      {feat}
                    </li>
                  ))}
                </ul>
              )}

              <button className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                offer.is_highlighted
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
                Choisir cette offre
              </button>
            </div>
          );
        })}
      </div>

      {offers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune offre disponible pour le moment.</p>
        </div>
      )}
    </div>
  );
}
