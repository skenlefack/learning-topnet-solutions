'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { commerceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ArrowLeft, ShoppingCart, Tag, AlertCircle } from 'lucide-react';

export default function OfferDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [useInstallments, setUseInstallments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (code) {
      commerceApi.offer(code)
        .then((res) => setOffer(res.data))
        .catch(() => setError('Offre introuvable'))
        .finally(() => setLoading(false));
    }
  }, [code]);

  const handlePurchase = async () => {
    if (!token) {
      router.push('/login?redirect=/shop/' + code);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await commerceApi.createOrder(token, {
        offerCode: code,
        coupon: coupon || undefined,
        useInstallments,
      }) as any;
      if (res.success && res.data) {
        router.push(`/orders/${res.data.ref}`);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la creation de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: offer?.currency || 'XAF',
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

  if (!offer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="text-gray-600">{error || 'Offre introuvable'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/shop')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux offres
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {offer.name?.fr || offer.name?.en || offer.code}
        </h1>
        {offer.tagline?.fr && (
          <p className="text-gray-500 dark:text-gray-400 mb-6">{offer.tagline.fr}</p>
        )}

        {offer.description?.fr && (
          <div className="prose dark:prose-invert mb-6 text-sm">
            <p>{offer.description.fr}</p>
          </div>
        )}

        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          {formatPrice(offer.price)}
        </div>

        {offer.features && offer.features.length > 0 && (
          <ul className="space-y-2 mb-8 border-t border-gray-100 dark:border-gray-700 pt-6">
            {(offer.features as string[]).map((feat: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">&#10003;</span>
                {feat}
              </li>
            ))}
          </ul>
        )}

        {/* Coupon */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Code promo (optionnel)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="PROMO-XXXX"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Installments */}
        {offer.max_installments > 1 && (
          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={useInstallments}
              onChange={(e) => setUseInstallments(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Payer en {offer.max_installments} fois sans frais
            </span>
          </label>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              {token ? 'Commander' : 'Se connecter pour commander'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
