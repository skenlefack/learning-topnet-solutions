'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { commerceApi } from '@/lib/api';
import { Heart, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

export default function SponsorPayPage() {
  const { token: sponsorToken } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [proofRef, setProofRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (sponsorToken) {
      commerceApi.sponsorGet(sponsorToken)
        .then((res) => setData(res.data))
        .catch(() => setError('Lien de paiement invalide'))
        .finally(() => setLoading(false));
    }
  }, [sponsorToken]);

  const handlePay = async () => {
    if (!selectedProvider || !payerName) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await commerceApi.sponsorPay(sponsorToken, {
        providerId: selectedProvider,
        payerName,
        payerPhone,
        proofRef: proofRef || undefined,
      }) as any;

      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
      setResult(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: currency || 'XAF', minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data || error === 'Lien de paiement invalide') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600">Lien de paiement invalide ou expire.</p>
      </div>
    );
  }

  const order = data.order;
  const isPaid = order?.status === 'paid';
  const providers = data.providers || [];
  const selectedObj = providers.find((p: any) => p.id === selectedProvider);
  const isManual = selectedObj?.integration_type === 'manual';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Heart className="w-10 h-10 text-pink-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Payer pour {data.beneficiary}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {order?.offerName?.fr || order?.offerName?.en || 'Commande'}
          </p>
        </div>

        {isPaid || result?.status === 'paid' ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-green-600">Paiement confirme !</p>
            <p className="text-gray-500 mt-2">Merci pour votre soutien.</p>
          </div>
        ) : result?.status === 'awaiting' ? (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-orange-600">Paiement en attente de validation</p>
            <p className="text-gray-500 mt-2">L'administrateur verifiera votre paiement sous peu.</p>
          </div>
        ) : (
          <>
            <div className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {formatPrice(order.amount, order.currency)}
            </div>

            {/* Provider selection */}
            <div className="space-y-2 mb-6">
              {providers.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${
                    selectedProvider === p.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {p.display_name?.fr || p.adapter_name}
                </button>
              ))}
            </div>

            {selectedProvider && (
              <div className="space-y-3">
                {isManual && selectedObj?.description?.fr && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                    {selectedObj.description.fr}
                  </div>
                )}
                <input type="text" value={payerName} onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Votre nom *" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="tel" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder="Votre telephone" className="w-full px-3 py-2 border rounded-lg text-sm" />
                {isManual && (
                  <input type="text" value={proofRef} onChange={(e) => setProofRef(e.target.value)}
                    placeholder="Reference de transaction *" className="w-full px-3 py-2 border rounded-lg text-sm" />
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={handlePay} disabled={submitting || !payerName}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <><ExternalLink className="w-4 h-4" /> Payer</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
