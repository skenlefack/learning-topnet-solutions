'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { commerceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ArrowLeft, CheckCircle, ExternalLink, Copy, Clock, XCircle } from 'lucide-react';

export default function OrderDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const [data, setData] = useState<{ order: any; providers: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [proofRef, setProofRef] = useState('');
  const [error, setError] = useState('');
  const [payResult, setPayResult] = useState<any>(null);
  const router = useRouter();
  const { token } = useAuthStore();

  const loadOrder = useCallback(async () => {
    if (!token || !ref) return;
    try {
      const res = await commerceApi.order(token, ref) as any;
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, ref]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handlePay = async () => {
    if (!token || !selectedProvider) return;
    setPayLoading(true);
    setError('');
    try {
      const res = await commerceApi.payOrder(token, ref, {
        providerId: selectedProvider,
        payerName: payerName || undefined,
        payerPhone: payerPhone || undefined,
        proofRef: proofRef || undefined,
      }) as any;

      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
      setPayResult(res.data);
      loadOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPayLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: currency || 'XAF', minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const order = data?.order;
  const providers = data?.providers || [];

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
        Commande introuvable
      </div>
    );
  }

  const isPaid = order.status === 'paid';
  const canPay = ['pending', 'awaiting'].includes(order.status);
  const selectedProviderObj = providers.find((p: any) => p.id === selectedProvider);
  const isManual = selectedProviderObj?.integration_type === 'manual';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/orders')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Mes commandes
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {order.offer_name?.fr || order.offer_name?.en || order.ref}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Ref: {order.ref}</p>
          </div>
          {isPaid && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Paye
            </span>
          )}
          {order.status === 'awaiting' && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm font-medium">
              <Clock className="w-4 h-4" /> En attente de validation
            </span>
          )}
          {order.status === 'rejected' && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium">
              <XCircle className="w-4 h-4" /> Rejete
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          {formatPrice(order.amount, order.currency)}
        </div>
        {order.discount > 0 && (
          <p className="text-sm text-green-600 mb-4">Remise: -{formatPrice(order.discount, order.currency)}</p>
        )}
        {order.installments_total > 1 && (
          <p className="text-sm text-gray-500 mb-4">
            Echeance {order.installment_no}/{order.installments_total}
          </p>
        )}

        {/* Sponsor link */}
        {order.sponsor_token && canPay && (
          <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Lien de paiement par un tiers (proche, employeur) :
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded border truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/sponsor/${order.sponsor_token}` : ''}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/sponsor/${order.sponsor_token}`)}
                className="p-2 text-gray-500 hover:text-gray-700"
                title="Copier"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Payment form */}
        {canPay && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Choisir un moyen de paiement
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {providers.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedProvider === p.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {p.display_name?.fr || p.display_name?.en || p.adapter_name}
                  </p>
                  {p.description?.fr && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.description.fr}</p>
                  )}
                </button>
              ))}
            </div>

            {selectedProvider && (
              <div className="space-y-4">
                {/* Provider instructions */}
                {isManual && selectedProviderObj?.description?.fr && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
                    {selectedProviderObj.description.fr}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du payeur</label>
                    <input type="text" value={payerName} onChange={(e) => setPayerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telephone</label>
                    <input type="tel" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
                  </div>
                </div>

                {isManual && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reference de la transaction / preuve de paiement *
                    </label>
                    <input type="text" value={proofRef} onChange={(e) => setProofRef(e.target.value)}
                      placeholder="Ex: MP261013.1452.A12345"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                {payResult?.instructions && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    {payResult.instructions}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={payLoading || (isManual && proofRef.length < 4)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {payLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Payer {formatPrice(order.amount, order.currency)}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {order.admin_note && (
          <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300">
            <strong>Note admin :</strong> {order.admin_note}
          </div>
        )}
      </div>
    </div>
  );
}
